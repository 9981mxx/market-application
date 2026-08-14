import { requireAccount } from "@/server/auth";
import { getD1, writeAudit } from "@/server/database";
import { ApiError, cleanText, errorResponse, readJson, requireText } from "@/server/http";
import { accessibleChannelIds, requirePermission } from "@/server/policy";
import { notifyRoles } from "@/server/notifications";

function scopeFilter(account: { role: string; channelId: string | null }, channelIds: string[], alias = "a") {
  if (account.role === "super_admin") return { sql: "1 = 1", values: [] as unknown[] };
  if (account.role !== "market") return { sql: "w.requester_account_id = ?", values: [] as unknown[] };
  if (!channelIds.length) return { sql: "1 = 0", values: [] as unknown[] };
  return { sql: `${alias}.channel_id IN (${channelIds.map(() => "?").join(",")})`, values: channelIds };
}

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "withdrawal.read");
    const channelIds = await accessibleChannelIds(account);
    const scope = scopeFilter(account, channelIds);
    const url = new URL(request.url);
    const status = cleanText(url.searchParams.get("status"), 20);
    const conditions = [scope.sql];
    const values = [...scope.values];
    if (account.role !== "super_admin" && account.role !== "market") values[0] = account.id;
    if (status) { conditions.push("w.status = ?"); values.push(status); }
    const result = await getD1().prepare(`
      SELECT w.id, w.requester_account_id, w.amount, w.method, w.account_name, w.account_number,
        w.remark, w.status, w.reviewed_by, w.reviewed_at, w.review_note, w.created_at, w.updated_at,
        a.username, a.display_name, a.role, c.name AS channel_name
      FROM withdrawal_requests w
      JOIN accounts a ON a.id = w.requester_account_id
      LEFT JOIN channels c ON c.id = a.channel_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY w.created_at DESC
      LIMIT 200
    `).bind(...values).all();
    return Response.json({ withdrawals: result.results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "withdrawal.write");
    const payload = await readJson<Record<string, unknown>>(request);
    const amount = Number(payload.amount);
    if (!Number.isInteger(amount) || amount <= 0 || amount > 1000000000) throw new ApiError(400, "amount must be a positive integer");
    const method = requireText(payload.method, "method", 30);
    const accountName = requireText(payload.accountName, "accountName", 80);
    const accountNumber = requireText(payload.accountNumber, "accountNumber", 120);
    const remark = cleanText(payload.remark, 500);
    const id = crypto.randomUUID();
    await getD1().prepare(`
      INSERT INTO withdrawal_requests (id, requester_account_id, amount, method, account_name, account_number, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, account.id, amount, method, accountName, accountNumber, remark).run();
    await notifyRoles(["super_admin", "market"], {
      type: "withdrawal_submitted",
      title: "New withdrawal request",
      content: `${account.displayName} submitted a withdrawal request for ${amount}.`,
      relatedType: "withdrawal",
      relatedId: id,
    }, account.id);
    await writeAudit(account.id, "withdrawal.create", "withdrawal", id, { amount, method });
    return Response.json({ withdrawal: { id, status: "pending" } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}