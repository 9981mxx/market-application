import { requireAccount } from "@/server/auth";
import { getD1, writeAudit } from "@/server/database";
import { ApiError, cleanText, errorResponse } from "@/server/http";
import { requirePermission } from "@/server/policy";

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "notification.read");
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unread") === "1";
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    const result = await getD1().prepare(`
      SELECT id, type, title, content, related_type, related_id, is_read, read_at, created_at
      FROM notifications
      WHERE recipient_account_id = ? ${unreadOnly ? "AND is_read = 0" : ""}
      ORDER BY created_at DESC LIMIT ?
    `).bind(account.id, limit).all();
    const unread = await getD1().prepare("SELECT COUNT(*) AS count FROM notifications WHERE recipient_account_id = ? AND is_read = 0")
      .bind(account.id).first<{ count: number }>();
    return Response.json({ notifications: result.results, unreadCount: Number(unread?.count ?? 0) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "notification.write");
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = cleanText(body.action, 30) || url.searchParams.get("action") || "read_all";
    const db = getD1();
    if (action === "read_all") {
      await db.prepare("UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE recipient_account_id = ? AND is_read = 0")
        .bind(account.id).run();
      await writeAudit(account.id, "notification.read_all", "notification", null);
      return Response.json({ success: true });
    }
    const id = cleanText(body.id, 80) || url.searchParams.get("id");
    if (!id) throw new ApiError(400, "notification id is required");
    const result = await db.prepare("UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ? AND recipient_account_id = ?")
      .bind(id, account.id).run();
    if (!result.meta.changes) return Response.json({ success: true });
    await writeAudit(account.id, "notification.read", "notification", id);
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}