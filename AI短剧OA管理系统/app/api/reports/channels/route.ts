import { requireAccount } from "@/server/auth";
import { getD1 } from "@/server/database";
import { errorResponse } from "@/server/http";
import { accessibleChannelIds, requirePermission } from "@/server/policy";

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "report.read");
    const ids = await accessibleChannelIds(account);
    if (!ids.length) return Response.json({ channels: [] });
    const result = await getD1().prepare(`
      SELECT c.id, c.code, c.name, c.role, c.status, c.target_rate, c.created_at,
        COUNT(DISTINCT u.id) AS user_count,
        COUNT(DISTINCT CASE WHEN u.recharge_amount > 0 THEN u.id END) AS charged_user_count,
        COALESCE(SUM(u.recharge_amount), 0) AS recharge_amount
      FROM channels c LEFT JOIN end_users u ON u.owner_channel_id = c.id
      WHERE c.id IN (${ids.map(() => "?").join(",")})
      GROUP BY c.id ORDER BY recharge_amount DESC, c.created_at DESC
    `).bind(...ids).all();
    return Response.json({ channels: result.results });
  } catch (error) {
    return errorResponse(error);
  }
}