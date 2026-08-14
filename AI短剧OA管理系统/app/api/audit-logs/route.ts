import { requireAccount } from "@/server/auth";
import { getD1 } from "@/server/database";
import { cleanText, errorResponse } from "@/server/http";
import { accessibleChannelIds, requirePermission } from "@/server/policy";

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "audit.read");
    const url = new URL(request.url);
    const action = cleanText(url.searchParams.get("action"), 128);
    const targetType = cleanText(url.searchParams.get("targetType"), 64);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (action) { conditions.push("l.action = ?"); values.push(action); }
    if (targetType) { conditions.push("l.target_type = ?"); values.push(targetType); }
    if (account.role !== "super_admin") {
      const ids = await accessibleChannelIds(account);
      if (!ids.length) conditions.push("l.actor_account_id = ?");
      else {
        conditions.push(`(l.actor_account_id = ? OR a.channel_id IN (${ids.map(() => "?").join(",")}))`);
        values.push(account.id, ...ids);
      }
    }
    const result = await getD1().prepare(`
      SELECT l.id, l.actor_account_id, l.action, l.target_type, l.target_id, l.detail, l.created_at,
        a.display_name AS actor_name, a.username AS actor_username, a.role AS actor_role
      FROM audit_logs l
      LEFT JOIN accounts a ON a.id = l.actor_account_id
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY l.created_at DESC LIMIT ? OFFSET ?
    `).bind(...values, limit, offset).all();
    return Response.json({ logs: result.results, limit, offset });
  } catch (error) {
    return errorResponse(error);
  }
}