import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const roles = sqliteTable("roles", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  level: integer("level").notNull(),
});

export const rolePermissions = sqliteTable("role_permissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  role: text("role").notNull(),
  permission: text("permission").notNull(),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  phone: text("phone").unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status").notNull().default("active"),
  channelId: text("channel_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  accountId: text("account_id").notNull().unique(),
  parentChannelId: text("parent_channel_id"),
  name: text("name").notNull(),
  role: text("role").notNull(),
  region: text("region").notNull().default(""),
  contactName: text("contact_name").notNull().default(""),
  contactPhone: text("contact_phone").notNull().default(""),
  status: text("status").notNull().default("active"),
  targetRate: integer("target_rate").notNull().default(0),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const endUsers = sqliteTable("end_users", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email").notNull().default(""),
  status: text("status").notNull().default("active"),
  tag: text("tag").notNull().default("新用户"),
  level: text("level").notNull().default("普通用户"),
  product: text("product").notNull().default("未购买"),
  rechargeAmount: integer("recharge_amount").notNull().default(0),
  note: text("note").notNull().default(""),
  invitedByAccountId: text("invited_by_account_id").notNull(),
  ownerChannelId: text("owner_channel_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const invitations = sqliteTable("invitations", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  inviterAccountId: text("inviter_account_id").notNull(),
  targetRole: text("target_role").notNull(),
  status: text("status").notNull().default("active"),
  maxUses: integer("max_uses").notNull().default(0),
  useCount: integer("use_count").notNull().default(0),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const invitationBindings = sqliteTable("invitation_bindings", {
  id: text("id").primaryKey(),
  invitationId: text("invitation_id").notNull(),
  inviteeType: text("invitee_type").notNull(),
  inviteeId: text("invitee_id").notNull(),
  inviterAccountId: text("inviter_account_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  actorAccountId: text("actor_account_id"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  detail: text("detail").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});