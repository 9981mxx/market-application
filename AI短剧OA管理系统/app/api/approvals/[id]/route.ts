import { requireAccount } from "@/server/auth";
import { getD1, writeAudit } from "@/server/database";
import { ApiError, errorResponse, readJson, cleanText } from "@/server/http";
import { requirePermission } from "@/server/policy";
import { createNotification } from "@/server/notifications";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "approval.write");
    const { id } = await context.params;
    const payload = await readJson<Record<string, unknown>>(request);
    const status = cleanText(payload.status, 20);
    if (status !== "approved" && status !== "rejected") throw new ApiError(400, "status must be approved or rejected");
    const reviewNote = cleanText(payload.reviewNote, 500);
    const row = await getD1().prepare(`
      SELECT w.requester_account_id, w.status, a.channel_id
      FROM withdrawal_requests w JOIN accounts a ON a.id = w.requester_account_id
      WHERE w.id = ? LIMIT 1
    `).bind(id).first<{ requester_account_id: string; status: string; channel_id: string | null }>();
    if (!row) throw new ApiError(404, "Withdrawal request not found");
    if (row.status !== "pending") throw new ApiError(409, "Only pending requests can be reviewed");
    if (account.role === "market" && (!account.channelId || row.channel_id !== account.channelId)) throw new ApiError(403, "Forbidden");
    await getD1().prepare(`
      UPDATE withdrawal_requests
      SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `).bind(status, account.id, reviewNote, id).run();
    await createNotification({
      recipientAccountId: row.requester_account_id,
      type: `withdrawal_${status}`,
      title: status === "approved" ? "Withdrawal approved" : "Withdrawal rejected",
      content: status === "approved" ? "Your withdrawal request has been approved." : `Your withdrawal request was rejected. ${reviewNote}`,
      relatedType: "withdrawal",
      relatedId: id,
    });
    await writeAudit(account.id, `withdrawal.${status}`, "withdrawal", id, { reviewNote });
    return Response.json({ success: true, status });
  } catch (error) {
    return errorResponse(error);
  }
}