import { requireAccount } from "@/server/auth";
import { getD1, writeAudit } from "@/server/database";
import { ApiError, cleanText, errorResponse, readJson, requireText } from "@/server/http";
import { assertChannelRoleWritable, requireChannelAccess, requirePermission } from "@/server/policy";
import { hashPassword } from "@/server/security";
import type { Role } from "@/server/types";

const CHANNEL_ROLES = new Set<Role>(["market", "franchise", "agent"]);
const STATUS_VALUES = new Set(["active", "observing", "suspended"]);

function normalizeRole(value: unknown): Role {
  const role = cleanText(value, 20) as Role;
  if (!CHANNEL_ROLES.has(role)) throw new ApiError(400, "渠道角色不正确");
  return role;
}

function duplicateError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint failed")) throw new ApiError(409, "登录名或手机号已存在");
  throw error;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "channel.read");
    const { id } = await context.params;
    await requireChannelAccess(account, id);
    const channel = await getD1().prepare(`
      SELECT c.id, c.code, c.account_id, c.name, c.role, c.region, c.contact_name, c.contact_phone, c.status, c.target_rate, c.created_at, c.updated_at, a.username, a.phone AS login_phone, a.display_name,
        COUNT(DISTINCT u.id) AS user_count, COALESCE(SUM(u.recharge_amount), 0) AS recharge_amount
      FROM channels c JOIN accounts a ON a.id = c.account_id
      LEFT JOIN end_users u ON u.owner_channel_id = c.id
      WHERE c.id = ? GROUP BY c.id LIMIT 1
    `).bind(id).first();
    if (!channel) throw new ApiError(404, "渠道不存在");
    return Response.json({ channel });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "channel.write");
    const { id } = await context.params;
    await requireChannelAccess(account, id);
    const db = getD1();
    const current = await db.prepare("SELECT c.*, a.username, a.phone AS login_phone FROM channels c JOIN accounts a ON a.id = c.account_id WHERE c.id = ? LIMIT 1")
      .bind(id).first<{ account_id: string; role: Role; name: string }>();
    if (!current) throw new ApiError(404, "渠道不存在");
    const payload = await readJson<Record<string, unknown>>(request);
    const name = requireText(payload.name, "渠道名称", 80);
    const role = normalizeRole(payload.role);
    assertChannelRoleWritable(account, role);
    if (account.channelId === id && role !== current.role) throw new ApiError(400, "不能修改当前登录账号自身的角色");
    const username = requireText(payload.username, "登录用户名", 50);
    const phone = requireText(payload.phone, "登录手机号", 30);
    const region = cleanText(payload.region, 80);
    const contactName = cleanText(payload.contactName, 50);
    const contactPhone = cleanText(payload.contactPhone, 30) || phone;
    const status = cleanText(payload.status, 20) || "active";
    if (!STATUS_VALUES.has(status)) throw new ApiError(400, "渠道状态不正确");
    const targetRate = Math.max(0, Math.min(100, Number(payload.targetRate) || 0));
    const statements = [
      db.prepare("UPDATE channels SET name = ?, role = ?, region = ?, contact_name = ?, contact_phone = ?, status = ?, target_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(name, role, region, contactName, contactPhone, status, targetRate, id),
      db.prepare("UPDATE accounts SET username = ?, phone = ?, display_name = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(username, phone, name, role, status === "suspended" ? "disabled" : "active", current.account_id),
    ];
    const password = cleanText(payload.password, 128);
    if (password) {
      if (password.length < 8) throw new ApiError(400, "新密码至少需要 8 位");
      statements.push(db.prepare("UPDATE accounts SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(await hashPassword(password), current.account_id));
    }
    try {
      await db.batch(statements);
    } catch (error) {
      duplicateError(error);
    }
    await writeAudit(account.id, "channel.update", "channel", id, { before: { name: current.name, role: current.role }, after: { name, role, status } });
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}