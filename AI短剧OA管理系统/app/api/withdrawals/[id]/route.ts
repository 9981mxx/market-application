import { requireAccount } from "@/server/auth";
import { getD1, writeAudit } from "@/server/database";
import { ApiError, errorResponse } from "@/server/http";
import { accessibleChannelIds, requirePermission } from "@/server/policy";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "withdrawal.read");
    const { id } = await context.params;
    const row = await getD1().prepare(`
      SELECT w.*, a.username, a.display_name, a.role, a.channel_id, c.name AS channel_name
      FROM withdrawal_requests w JOIN accounts a ON a.id = w.requester_account_id
      LEFT JOIN channels c ON c.id = a.channel_id WHERE w.id = ? LIMIT 1
    `).bind(id).first<{ requester_account_id: string; channel_id: string | null; status: string }>();
    if (!row) throw new ApiError(404, "Withdrawal request not found");
    if (account.role !== "super_admin" && account.role !== "market") {
      if (row.requester_account_id !== account.id) throw new ApiError(403, "Forbidden");
    } else if (account.role === "market") {
      const ids = await accessibleChannelIds(account);
      if (!row.channel_id || !ids.includes(row.channel_id)) throw new ApiError(403, "Forbidden");
    }
    return Response.json({ withdrawal: row });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "withdrawal.write");
    const { id } = await context.params;
    const result = await getD1().prepare("UPDATE withdrawal_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND requester_account_id = ? AND status = 'pending'")
      .bind(id, account.id).run();
    if (!result.meta.changes) throw new ApiError(404, "Pending withdrawal request not found");
    await writeAudit(account.id, "withdrawal.cancel", "withdrawal", id);
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}