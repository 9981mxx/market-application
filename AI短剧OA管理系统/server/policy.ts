import { getD1 } from "./database";
import { ApiError } from "./http";
import type { AuthAccount, InviteTargetRole, Role } from "./types";

export type Permission =
  | "account.read"
  | "account.write"
  | "channel.read"
  | "channel.write"
  | "user.read"
  | "user.write"
  | "invitation.read"
  | "invitation.write"
  | "withdrawal.read"
  | "withdrawal.write"
  | "approval.read"
  | "approval.write"
  | "notification.read"
  | "notification.write"
  | "audit.read"
  | "file.read"
  | "file.write"
  | "report.read"
  | "config.read"
  | "config.write";

const INVITE_TARGETS: Record<Role, InviteTargetRole[]> = {
  super_admin: ["market", "franchise", "agent", "user"],
  market: ["franchise", "agent", "user"],
  franchise: ["agent", "user"],
  agent: ["user"],
};

export function allowedInviteTargets(role: Role): InviteTargetRole[] {
  return INVITE_TARGETS[role];
}

export async function requirePermission(account: AuthAccount, permission: Permission): Promise<void> {
  const row = await getD1().prepare("SELECT 1 AS allowed FROM role_permissions WHERE role = ? AND permission = ? LIMIT 1")
    .bind(account.role, permission)
    .first<{ allowed: number }>();
  if (!row) throw new ApiError(403, "当前角色无权执行此操作");
}

export function assertInviteTarget(account: AuthAccount, targetRole: InviteTargetRole): void {
  if (!INVITE_TARGETS[account.role].includes(targetRole)) {
    throw new ApiError(403, "当前角色不能邀请该类型账号");
  }
}

export function assertChannelRoleWritable(account: AuthAccount, role: Role): void {
  const allowed: Record<Role, Role[]> = {
    super_admin: ["market", "franchise", "agent"],
    market: ["franchise", "agent"],
    franchise: [],
    agent: [],
  };
  if (!allowed[account.role].includes(role)) throw new ApiError(403, "不能创建或修改为该渠道角色");
}

export async function accessibleChannelIds(account: AuthAccount): Promise<string[]> {
  const db = getD1();
  if (account.role === "super_admin") {
    const result = await db.prepare("SELECT id FROM channels").all<{ id: string }>();
    return result.results.map((row) => row.id);
  }
  if (!account.channelId) return [];
  const result = await db.prepare(`
    WITH RECURSIVE channel_scope(id) AS (
      SELECT id FROM channels WHERE id = ?
      UNION ALL
      SELECT child.id FROM channels child JOIN channel_scope parent ON child.parent_channel_id = parent.id
    )
    SELECT id FROM channel_scope
  `).bind(account.channelId).all<{ id: string }>();
  return result.results.map((row) => row.id);
}

export async function requireChannelAccess(account: AuthAccount, channelId: string): Promise<void> {
  const ids = await accessibleChannelIds(account);
  if (!ids.includes(channelId)) throw new ApiError(403, "无权访问该渠道数据");
}