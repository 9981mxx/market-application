import { requireAccount } from "@/server/auth";
import { getD1, writeAudit } from "@/server/database";
import { ApiError, cleanText, errorResponse, readJson, requireText } from "@/server/http";
import { accessibleChannelIds, assertChannelRoleWritable, requireChannelAccess, requirePermission } from "@/server/policy";
import { hashPassword } from "@/server/security";
import type { Role } from "@/server/types";

const CHANNEL_ROLES = new Set<Role>(["market", "franchise", "agent"]);
const STATUS_VALUES = new Set(["active", "observing", "suspended"]);

function normalizeRole(value: unknown): Role {
  const role = cleanText(value, 20) as Role;
  if (!CHANNEL_ROLES.has(role)) throw new ApiError(400, "渠道角色不正确");
  return role;
}

function normalizeStatus(value: unknown): string {
  const status = cleanText(value, 20) || "active";
  if (!STATUS_VALUES.has(status)) throw new ApiError(400, "渠道状态不正确");
  return status;
}

function channelCode(role: Role): string {
  const prefix = role === "market" ? "A" : role === "franchise" ? "B" : "C";
  return `${prefix}-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;
}

function duplicateError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint failed")) throw new ApiError(409, "登录名、手机号或渠道编号已存在");
  throw error;
}

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "channel.read");
    const ids = await accessibleChannelIds(account);
    if (!ids.length) return Response.json({ channels: [] });
    const placeholders = ids.map(() => "?").join(",");
    const result = await getD1().prepare(`
      SELECT c.id, c.code, c.account_id, c.name, c.role, c.region,
        c.contact_name, c.contact_phone, c.status, c.target_rate, c.created_at, c.updated_at,
        a.username, a.phone AS login_phone,
        COUNT(DISTINCT u.id) AS user_count,
        COALESCE(SUM(u.recharge_amount), 0) AS recharge_amount
      FROM channels c
      JOIN accounts a ON a.id = c.account_id
      LEFT JOIN end_users u ON u.owner_channel_id = c.id
      WHERE c.id IN (${placeholders})
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).bind(...ids).all();
    return Response.json({ channels: result.results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "channel.write");
    const payload = await readJson<Record<string, unknown>>(request);
    const name = requireText(payload.name, "渠道名称", 80);
    const role = normalizeRole(payload.role);
    assertChannelRoleWritable(account, role);
    const username = requireText(payload.username, "登录用户名", 50);
    const phone = requireText(payload.phone, "登录手机号", 30);
    const password = requireText(payload.password, "初始密码", 128);
    if (password.length < 8) throw new ApiError(400, "初始密码至少需要 8 位");
    const region = cleanText(payload.region, 80);
    const contactName = cleanText(payload.contactName, 50);
    const contactPhone = cleanText(payload.contactPhone, 30) || phone;
    const status = normalizeStatus(payload.status);
    const targetRate = Math.max(0, Math.min(100, Number(payload.targetRate) || 0));
    let parentChannelId = cleanText(payload.parentChannelId, 80) || account.channelId;
    if (account.role === "super_admin" && !cleanText(payload.parentChannelId, 80)) parentChannelId = null;
    if (parentChannelId) await requireChannelAccess(account, parentChannelId);

    const db = getD1();
    const channelId = crypto.randomUUID();
    const accountId = crypto.randomUUID();
    const code = channelCode(role);
    const passwordHash = await hashPassword(password);
    try {
      await db.batch([
        db.prepare("INSERT INTO accounts (id, username, phone, password_hash, role, display_name, status, channel_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(accountId, username, phone, passwordHash, role, name, status === "suspended" ? "disabled" : "active", channelId),
        db.prepare("INSERT INTO channels (id, code, account_id, parent_channel_id, name, role, region, contact_name, contact_phone, status, target_rate, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(channelId, code, accountId, parentChannelId, name, role, region, contactName, contactPhone, status, targetRate, account.id),
      ]);
    } catch (error) {
      duplicateError(error);
    }
    await writeAudit(account.id, "channel.create", "channel", channelId, { name, role, code });
    return Response.json({ channel: { id: channelId, code } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}