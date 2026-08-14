import { requireAccount } from "@/server/auth";
import { getD1, writeAudit } from "@/server/database";
import { ApiError, errorResponse } from "@/server/http";
import { requirePermission } from "@/server/policy";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "notification.read");
    const { id } = await context.params;
    const row = await getD1().prepare("SELECT * FROM notifications WHERE id = ? AND recipient_account_id = ? LIMIT 1")
      .bind(id, account.id).first();
    if (!row) throw new ApiError(404, "Notification not found");
    return Response.json({ notification: row });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "notification.write");
    const { id } = await context.params;
    const result = await getD1().prepare("UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ? AND recipient_account_id = ?")
      .bind(id, account.id).run();
    if (!result.meta.changes) throw new ApiError(404, "Notification not found");
    await writeAudit(account.id, "notification.read", "notification", id);
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}