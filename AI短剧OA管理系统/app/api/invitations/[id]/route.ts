import { requireAccount } from "@/server/auth";
import { getD1, writeAudit } from "@/server/database";
import { ApiError, cleanText, errorResponse, readJson } from "@/server/http";
import { requirePermission } from "@/server/policy";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "invitation.write");
    const { id } = await context.params;
    const invitation = await getD1().prepare("SELECT id, status FROM invitations WHERE id = ? AND inviter_account_id = ? LIMIT 1")
      .bind(id, account.id).first<{ id: string; status: string }>();
    if (!invitation) throw new ApiError(404, "邀请码不存在");
    const payload = await readJson<Record<string, unknown>>(request);
    const status = cleanText(payload.status, 20);
    if (!new Set(["active", "revoked"]).has(status)) throw new ApiError(400, "邀请码状态不正确");
    await getD1().prepare("UPDATE invitations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, id).run();
    await writeAudit(account.id, "invitation.status", "invitation", id, { before: invitation.status, after: status });
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}