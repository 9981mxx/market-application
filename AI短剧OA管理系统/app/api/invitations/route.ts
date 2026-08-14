import { requireAccount } from "@/server/auth";
import { getD1, writeAudit } from "@/server/database";
import { ApiError, cleanText, errorResponse, readJson } from "@/server/http";
import { allowedInviteTargets, assertInviteTarget, requirePermission } from "@/server/policy";
import { INVITE_ROLE_LABELS, type InviteTargetRole } from "@/server/types";

function invitationCode(): string {
  return `LS${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

function inviteUrl(request: Request, code: string): string {
  return new URL(`/register?invite=${encodeURIComponent(code)}`, request.url).toString();
}

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "invitation.read");
    const result = await getD1().prepare(`
      SELECT i.id, i.code, i.target_role, i.status, i.max_uses, i.use_count, i.expires_at, i.created_at,
        COUNT(b.id) AS binding_count
      FROM invitations i
      LEFT JOIN invitation_bindings b ON b.invitation_id = i.id
      WHERE i.inviter_account_id = ?
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `).bind(account.id).all<{
      id: string; code: string; target_role: InviteTargetRole; status: string; max_uses: number;
      use_count: number; expires_at: string | null; created_at: string; binding_count: number;
    }>();
    const invitations = result.results.map((item) => ({
      ...item,
      target_role_label: INVITE_ROLE_LABELS[item.target_role],
      url: inviteUrl(request, item.code),
      qr_url: new URL(`/api/invitations/${item.id}/qrcode`, request.url).toString(),
    }));
    const bindings = await getD1().prepare(`
      SELECT b.id, b.invitee_type, b.invitee_id, b.created_at, i.target_role,
        COALESCE(a.display_name, u.name) AS invitee_name
      FROM invitation_bindings b
      JOIN invitations i ON i.id = b.invitation_id
      LEFT JOIN accounts a ON b.invitee_type = 'account' AND a.id = b.invitee_id
      LEFT JOIN end_users u ON b.invitee_type = 'user' AND u.id = b.invitee_id
      WHERE b.inviter_account_id = ?
      ORDER BY b.created_at DESC
      LIMIT 100
    `).bind(account.id).all();
    return Response.json({
      invitations,
      bindings: bindings.results,
      allowedTargets: allowedInviteTargets(account.role).map((role) => ({ role, label: INVITE_ROLE_LABELS[role] })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "invitation.write");
    const payload = await readJson<Record<string, unknown>>(request);
    const targetRole = cleanText(payload.targetRole, 20) as InviteTargetRole;
    assertInviteTarget(account, targetRole);
    const existing = await getD1().prepare(`
      SELECT id, code FROM invitations
      WHERE inviter_account_id = ? AND target_role = ? AND status = 'active'
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        AND (max_uses = 0 OR use_count < max_uses)
      ORDER BY created_at DESC LIMIT 1
    `).bind(account.id, targetRole).first<{ id: string; code: string }>();
    if (existing) {
      return Response.json({ invitation: { ...existing, url: inviteUrl(request, existing.code) } });
    }
    const maxUses = Math.max(0, Math.min(100000, Number(payload.maxUses) || 0));
    const expiresAt = cleanText(payload.expiresAt, 40) || null;
    if (expiresAt && Number.isNaN(Date.parse(expiresAt))) throw new ApiError(400, "失效时间格式不正确");
    const id = crypto.randomUUID();
    const code = invitationCode();
    await getD1().prepare("INSERT INTO invitations (id, code, inviter_account_id, target_role, max_uses, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, code, account.id, targetRole, maxUses, expiresAt)
      .run();
    await writeAudit(account.id, "invitation.create", "invitation", id, { code, targetRole, maxUses, expiresAt });
    return Response.json({ invitation: { id, code, url: inviteUrl(request, code) } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}