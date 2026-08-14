import { ensureDatabase, getD1 } from "@/server/database";
import { ApiError, errorResponse } from "@/server/http";
import { INVITE_ROLE_LABELS, type InviteTargetRole } from "@/server/types";

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    await ensureDatabase();
    const { code } = await context.params;
    const invitation = await getD1().prepare(`
      SELECT i.code, i.target_role, i.status, i.max_uses, i.use_count, i.expires_at,
        a.display_name AS inviter_name
      FROM invitations i JOIN accounts a ON a.id = i.inviter_account_id
      WHERE i.code = ? LIMIT 1
    `).bind(code).first<{
      code: string; target_role: InviteTargetRole; status: string; max_uses: number;
      use_count: number; expires_at: string | null; inviter_name: string;
    }>();
    if (!invitation) throw new ApiError(404, "邀请链接不存在");
    const expired = invitation.status !== "active"
      || (invitation.expires_at ? Date.parse(invitation.expires_at) <= Date.now() : false)
      || (invitation.max_uses > 0 && invitation.use_count >= invitation.max_uses);
    return Response.json({
      invitation: {
        code: invitation.code,
        targetRole: invitation.target_role,
        targetRoleLabel: INVITE_ROLE_LABELS[invitation.target_role],
        inviterName: invitation.inviter_name,
        available: !expired,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}