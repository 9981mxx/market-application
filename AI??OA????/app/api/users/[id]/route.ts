import { requireAccount } from "@/server/auth";
import { getD1, writeAudit } from "@/server/database";
import { ApiError, cleanText, errorResponse, readJson, requireText } from "@/server/http";
import { accessibleChannelIds, requirePermission } from "@/server/policy";

const STATUS_VALUES = new Set(["active", "inactive", "disabled"]);

type UserScopeRow = {
  id: string;
  name: string;
  phone: string;
  owner_channel_id: string | null;
  invited_by_account_id: string;
};

async function requireUserAccess(account: Awaited<ReturnType<typeof requireAccount>>, id: string): Promise<UserScopeRow> {
  const row = await getD1().prepare("SELECT id, name, phone, owner_channel_id, invited_by_account_id FROM end_users WHERE id = ? LIMIT 1")
    .bind(id).first<UserScopeRow>();
  if (!row) throw new ApiError(404, "用户不存在");
  if (account.role === "super_admin") return row;
  const channelIds = await accessibleChannelIds(account);
  if (row.invited_by_account_id !== account.id && (!row.owner_channel_id || !channelIds.includes(row.owner_channel_id))) {
    throw new ApiError(403, "无权访问该用户数据");
  }
  return row;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "user.read");
    const { id } = await context.params;
    await requireUserAccess(account, id);
    const user = await getD1().prepare(`
      SELECT u.*, a.display_name AS invited_by_name, a.role AS inviter_role
      FROM end_users u JOIN accounts a ON a.id = u.invited_by_account_id
      WHERE u.id = ? LIMIT 1
    `).bind(id).first();
    return Response.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    await requirePermission(account, "user.write");
    const { id } = await context.params;
    const current = await requireUserAccess(account, id);
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
    try {
      await getD1().prepare(`
        UPDATE end_users SET name = ?, phone = ?, email = ?, status = ?, tag = ?, level = ?, product = ?, note = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(name, phone, email, status, tag, level, product, note, id).run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("UNIQUE constraint failed")) throw new ApiError(409, "该手机号已经存在");
      throw error;
    }
    await writeAudit(account.id, "user.update", "user", id, { before: { name: current.name, phone: current.phone }, after: { name, phone, status } });
    return Response.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}