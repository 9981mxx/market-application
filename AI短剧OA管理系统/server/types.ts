export const ROLES = ["super_admin", "market", "franchise", "agent"] as const;
export type Role = (typeof ROLES)[number];
export type InviteTargetRole = Role | "user";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "超级管理员",
  market: "市场端",
  franchise: "加盟端",
  agent: "代理端",
};

export const LABEL_TO_ROLE: Record<string, Role> = {
  超级管理员: "super_admin",
  市场端: "market",
  加盟端: "franchise",
  代理端: "agent",
};

export const INVITE_ROLE_LABELS: Record<InviteTargetRole, string> = {
  ...ROLE_LABELS,
  user: "用户",
};

export type AuthAccount = {
  id: string;
  username: string;
  phone: string | null;
  displayName: string;
  role: Role;
  roleLabel: string;
  status: string;
  channelId: string | null;
};