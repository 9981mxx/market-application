import { ensureDatabase, getD1, writeAudit } from "@/server/database";
import { ApiError, cleanText, errorResponse, readJson, requireText } from "@/server/http";
import { allowedInviteTargets } from "@/server/policy";
import { hashPassword } from "@/server/security";
import { INVITE_ROLE_LABELS, type InviteTargetRole, type Role } from "@/server/types";

type InvitationRow = {
  id: string;
  code: string;
  inviter_account_id: string;
  target_role: InviteTargetRole;
  status: string;
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  inviter_role: Role;
  inviter_channel_id: string | null;
};

function generatedCode(role: InviteTargetRole): string {
  const prefix = role === "market" ? "A" : role === "franchise" ? "B" : role === "agent" ? "C" : "U";
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
}

function assertAvailable(invitation: InvitationRow): void {
  if (invitation.status !== "active") throw new ApiError(410, "该邀请已经失效");
  if (invitation.expires_at && Date.parse(invitation.expires_at) <= Date.now()) throw new ApiError(410, "该邀请已经过期");
  if (invitation.max_uses > 0 && invitation.use_count >= invitation.max_uses) throw new ApiError(410, "该邀请使用次数已满");
  if (!allowedInviteTargets(invitation.inviter_role).includes(invitation.target_role)) throw new ApiError(403, "邀请关系不符合当前角色规则");
}

function duplicateError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint failed")) throw new ApiError(409, "用户名或手机号已经注册");
  throw error;
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const payload = await readJson<Record<string, unknown>>(request);
    const inviteCode = requireText(payload.inviteCode, "邀请码", 40);
    const invitation = await getD1().prepare(`
      SELECT i.*, a.role AS inviter_role, a.channel_id AS inviter_channel_id
      FROM invitations i JOIN accounts a ON a.id = i.inviter_account_id
      WHERE i.code = ? LIMIT 1
    `).bind(inviteCode).first<InvitationRow>();
    if (!invitation) throw new ApiError(404, "邀请链接不存在");
    assertAvailable(invitation);

    const name = requireText(payload.name, "名称", 80);
    const phone = requireText(payload.phone, "手机号", 30);
    const email = cleanText(payload.email, 120);
    const db = getD1();
    const inviteeId = crypto.randomUUID();
    const bindingId = crypto.randomUUID();

    if (invitation.target_role === "user") {
      const code = generatedCode("user");
      try {
        await db.batch([
          db.prepare("INSERT INTO end_users (id, code, name, phone, email, invited_by_account_id, owner_channel_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .bind(inviteeId, code, name, phone, email, invitation.inviter_account_id, invitation.inviter_channel_id),
          db.prepare("INSERT INTO invitation_bindings (id, invitation_id, invitee_type, invitee_id, inviter_account_id) VALUES (?, ?, 'user', ?, ?)")
            .bind(bindingId, invitation.id, inviteeId, invitation.inviter_account_id),
          db.prepare("UPDATE invitations SET use_count = use_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(invitation.id),
        ]);
      } catch (error) {
        duplicateError(error);
      }
      await writeAudit(null, "invitation.accept", "user", inviteeId, { invitationId: invitation.id, inviterAccountId: invitation.inviter_account_id });
      return Response.json({ success: true, type: "user", id: inviteeId, code, roleLabel: "用户" }, { status: 201 });
    }

    const username = requireText(payload.username, "登录用户名", 50);
    const password = requireText(payload.password, "密码", 128);
    if (password.length < 8) throw new ApiError(400, "密码至少需要 8 位");
    const role = invitation.target_role;
    const channelId = crypto.randomUUID();
    const code = generatedCode(role);
    const region = cleanText(payload.region, 80);
    const passwordHash = await hashPassword(password);
    const parentChannelId = role === "market" ? null : invitation.inviter_channel_id;
    try {
      await db.batch([
        db.prepare("INSERT INTO accounts (id, username, phone, password_hash, role, display_name, channel_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(inviteeId, username, phone, passwordHash, role, name, channelId),
        db.prepare("INSERT INTO channels (id, code, account_id, parent_channel_id, name, role, region, contact_name, contact_phone, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(channelId, code, inviteeId, parentChannelId, name, role, region, name, phone, invitation.inviter_account_id),
        db.prepare("INSERT INTO invitation_bindings (id, invitation_id, invitee_type, invitee_id, inviter_account_id) VALUES (?, ?, 'account', ?, ?)")
          .bind(bindingId, invitation.id, inviteeId, invitation.inviter_account_id),
        db.prepare("UPDATE invitations SET use_count = use_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(invitation.id),
      ]);
    } catch (error) {
      duplicateError(error);
    }
    await writeAudit(null, "invitation.accept", "account", inviteeId, { invitationId: invitation.id, inviterAccountId: invitation.inviter_account_id, role });
    return Response.json({ success: true, type: "account", id: inviteeId, code, roleLabel: INVITE_ROLE_LABELS[role] }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}