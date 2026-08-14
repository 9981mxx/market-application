import { requireAccount } from "@/server/auth";
import { getD1, writeAudit } from "@/server/database";
import { ApiError, cleanText, errorResponse, readJson, requireText } from "@/server/http";
import { accessibleChannelIds, requirePermission } from "@/server/policy";

const STATUS_VALUES = new Set(["active", "inactive", "disabled"]);

function userCode(): string {
  return `U-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
}

function duplicateError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("UNIQUE constraint failed")) throw new ApiError(409, "该手机号已经存在");
  throw error;
}

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "user.read");
    const channelIds = await accessibleChannelIds(account);
    const bindings: unknown[] = [];
    let scopeSql = "1 = 1";
    if (account.role !== "super_admin") {
      const channelScope = channelIds.length ? `u.owner_channel_id IN (${channelIds.map(() => "?").join(",")})` : "0 = 1";
      scopeSql = `(u.invited_by_account_id = ? OR ${channelScope})`;
      bindings.push(account.id, ...channelIds);
    }
    const result = await getD1().prepare(`
      SELECT u.id, u.code, u.name, u.phone, u.email, u.status, u.tag, u.level, u.product,
        u.recharge_amount, u.note, u.invited_by_account_id, u.owner_channel_id,
        u.created_at, u.updated_at, a.display_name AS invited_by_name, a.role AS inviter_role
      FROM end_users u
      JOIN accounts a ON a.id = u.invited_by_account_id
      WHERE ${scopeSql}
      ORDER BY u.created_at DESC
    `).bind(...bindings).all();
    return Response.json({ users: result.results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "user.write");
    const payload = await readJson<Record<string, unknown>>(request);
    const name = requireText(payload.name, "用户姓名", 80);
    const phone = requireText(payload.phone, "手机号", 30);
    const email = cleanText(payload.email, 120);
    const tag = cleanText(payload.tag, 50) || "新用户";
    const level = cleanText(payload.level, 50) || "普通用户";
    const product = cleanText(payload.product, 80) || "未购买";
    const note = cleanText(payload.note, 500);
    const status = cleanText(payload.status, 20) || "active";
    if (!STATUS_VALUES.has(status)) throw new ApiError(400, "用户状态不正确");

    const inviterAccountId = cleanText(payload.invitedByAccountId, 80) || account.id;
    let ownerChannelId = account.channelId;
    if (inviterAccountId !== account.id) {
      const inviter = await getD1().prepare("SELECT id, channel_id FROM accounts WHERE id = ? AND status = 'active' LIMIT 1")
        .bind(inviterAccountId).first<{ id: string; channel_id: string | null }>();
      if (!inviter) throw new ApiError(400, "邀请账号不存在");
      const channelIds = await accessibleChannelIds(account);
      if (inviter.channel_id && !channelIds.includes(inviter.channel_id)) throw new ApiError(403, "不能将用户绑定到权限范围外的邀请账号");
      ownerChannelId = inviter.channel_id;
    }

    const id = crypto.randomUUID();
    const code = userCode();
    try {
      await getD1().prepare(`
        INSERT INTO end_users (id, code, name, phone, email, status, tag, level, product, recharge_amount, note, invited_by_account_id, owner_channel_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, code, name, phone, email, status, tag, level, product, 0, note, inviterAccountId, ownerChannelId).run();
    } catch (error) {
      duplicateError(error);
    }
    await writeAudit(account.id, "user.create", "user", id, { code, name, inviterAccountId });
    return Response.json({ user: { id, code } }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}