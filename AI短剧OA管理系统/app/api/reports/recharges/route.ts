import { requireAccount } from "@/server/auth";
import { getD1 } from "@/server/database";
import { errorResponse } from "@/server/http";
import { accessibleChannelIds, requirePermission } from "@/server/policy";

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "report.read");
    const ids = await accessibleChannelIds(account);
    if (!ids.length) return Response.json({ recharges: [] });
    const result = await getD1().prepare(`
      SELECT u.id, u.code, u.name, u.phone, u.product, u.recharge_amount, u.status,
        u.owner_channel_id, c.name AS channel_name, a.display_name AS inviter_name
      FROM end_users u
      LEFT JOIN channels c ON c.id = u.owner_channel_id
      LEFT JOIN accounts a ON a.id = u.invited_by_account_id
      WHERE u.owner_channel_id IN (${ids.map(() => "?").join(",")})
      ORDER BY u.recharge_amount DESC, u.created_at DESC
      LIMIT 500
    `).bind(...ids).all();
    const rows = result.results as Array<{ recharge_amount?: number }>;
    return Response.json({
      recharges: rows,
      chargedCount: rows.filter((row) => Number(row.recharge_amount) > 0).length,
      unchargedCount: rows.filter((row) => Number(row.recharge_amount) <= 0).length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}