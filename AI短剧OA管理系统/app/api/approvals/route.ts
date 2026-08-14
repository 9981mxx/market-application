import { requireAccount } from "@/server/auth";
import { getD1 } from "@/server/database";
import { cleanText, errorResponse } from "@/server/http";
import { accessibleChannelIds, requirePermission } from "@/server/policy";

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "approval.read");
    const url = new URL(request.url);
    const status = cleanText(url.searchParams.get("status"), 20) || "pending";
    const params: unknown[] = [status];
    let scope = "1 = 1";
    if (account.role === "market") {
      const ids = await accessibleChannelIds(account);
      if (!ids.length) scope = "1 = 0";
      else {
        scope = `a.channel_id IN (${ids.map(() => "?").join(",")})`;
        params.push(...ids);
      }
    }
    const result = await getD1().prepare(`
      SELECT w.id, w.amount, w.method, w.account_name, w.account_number, w.remark, w.status,
        w.created_at, w.reviewed_at, w.review_note, a.display_name, a.username, a.role,
        c.name AS channel_name
      FROM withdrawal_requests w JOIN accounts a ON a.id = w.requester_account_id
      LEFT JOIN channels c ON c.id = a.channel_id
      WHERE w.status = ? AND ${scope}
      ORDER BY w.created_at ASC LIMIT 200
    `).bind(...params).all();
    return Response.json({ approvals: result.results, type: "withdrawal" });
  } catch (error) {
    return errorResponse(error);
  }
}