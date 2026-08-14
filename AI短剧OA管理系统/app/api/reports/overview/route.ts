import { requireAccount } from "@/server/auth";
import { getD1 } from "@/server/database";
import { errorResponse } from "@/server/http";
import { accessibleChannelIds, requirePermission } from "@/server/policy";

function inClause(ids: string[]) { return ids.length ? ids.map(() => "?").join(",") : "NULL"; }

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "report.read");
    const ids = await accessibleChannelIds(account);
    const usersScope = `owner_channel_id IN (${inClause(ids)})`;
    const channelScope = `id IN (${inClause(ids)})`;
    const withdrawalScope = `a.channel_id IN (${inClause(ids)})`;
    const db = getD1();
    const [accounts, channels, users, charged, recharge, pending, approved] = await Promise.all([
      db.prepare(account.role === "super_admin" ? "SELECT COUNT(*) AS count FROM accounts" : `SELECT COUNT(*) AS count FROM accounts ${ids.length ? `WHERE channel_id IN (${inClause(ids)})` : "WHERE 1 = 0"}`).bind(...(account.role === "super_admin" ? [] : ids)).first<{ count: number }>(),
      db.prepare(`SELECT COUNT(*) AS count FROM channels WHERE ${ids.length ? channelScope : "1 = 0"}`).bind(...ids).first<{ count: number }>(),
      db.prepare(`SELECT COUNT(*) AS count FROM end_users WHERE ${ids.length ? usersScope : "1 = 0"}`).bind(...ids).first<{ count: number }>(),
      db.prepare(`SELECT COUNT(*) AS count FROM end_users WHERE recharge_amount > 0 AND ${ids.length ? usersScope : "1 = 0"}`).bind(...ids).first<{ count: number }>(),
      db.prepare(`SELECT COALESCE(SUM(recharge_amount), 0) AS amount FROM end_users WHERE ${ids.length ? usersScope : "1 = 0"}`).bind(...ids).first<{ amount: number }>(),
      db.prepare(`SELECT COALESCE(SUM(w.amount), 0) AS amount, COUNT(*) AS count FROM withdrawal_requests w JOIN accounts a ON a.id = w.requester_account_id WHERE w.status = 'pending' AND ${ids.length ? withdrawalScope : "1 = 0"}`).bind(...ids).first<{ amount: number; count: number }>(),
      db.prepare(`SELECT COALESCE(SUM(w.amount), 0) AS amount, COUNT(*) AS count FROM withdrawal_requests w JOIN accounts a ON a.id = w.requester_account_id WHERE w.status = 'approved' AND ${ids.length ? withdrawalScope : "1 = 0"}`).bind(...ids).first<{ amount: number; count: number }>(),
    ]);
    return Response.json({
      scopeChannelCount: ids.length,
      accountCount: Number(accounts?.count ?? 0),
      channelCount: Number(channels?.count ?? 0),
      userCount: Number(users?.count ?? 0),
      chargedUserCount: Number(charged?.count ?? 0),
      unchargedUserCount: Number(users?.count ?? 0) - Number(charged?.count ?? 0),
      rechargeAmount: Number(recharge?.amount ?? 0),
      pendingWithdrawalAmount: Number(pending?.amount ?? 0),
      pendingWithdrawalCount: Number(pending?.count ?? 0),
      approvedWithdrawalAmount: Number(approved?.amount ?? 0),
      approvedWithdrawalCount: Number(approved?.count ?? 0),
    });
  } catch (error) {
    return errorResponse(error);
  }
}