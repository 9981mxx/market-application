import { sql } from "drizzle-orm";
import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
export const withdrawalRequests = sqliteTable("withdrawal_requests", {
  id: text("id").primaryKey(),
  requesterAccountId: text("requester_account_id").notNull(),
  amount: integer("amount").notNull(),
  method: text("method").notNull(),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number").notNull(),
  remark: text("remark").notNull().default(""),
  status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
  reviewNote: text("review_note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  recipientAccountId: text("recipient_account_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  relatedType: text("related_type"),
  relatedId: text("related_id"),
  isRead: integer("is_read").notNull().default(0),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const fileAssets = sqliteTable("file_assets", {
  id: text("id").primaryKey(),
  uploaderAccountId: text("uploader_account_id").notNull(),
  originalName: text("original_name").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  checksum: text("checksum").notNull(),
  storageBackend: text("storage_backend").notNull().default("d1"),
  content: blob("content"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const systemConfigs = sqliteTable("system_configs", {
  configKey: text("config_key").primaryKey(),
  configValue: text("config_value").notNull(),
  valueType: text("value_type").notNull().default("string"),
  description: text("description").notNull().default(""),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const backupRuns = sqliteTable("backup_runs", {
  id: text("id").primaryKey(),
  createdBy: text("created_by").notNull(),
  status: text("status").notNull().default("completed"),
  tableCount: integer("table_count").notNull().default(0),
  recordCount: integer("record_count").notNull().default(0),
  snapshot: text("snapshot").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
});