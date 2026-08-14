import { env } from "cloudflare:workers";
import { hashPassword } from "./security";

let initialization: Promise<void> | null = null;

export function getD1(): D1Database {
  const database = (env as unknown as { DB?: D1Database }).DB;
  if (!database) throw new Error("Cloudflare D1 binding `DB` is unavailable");
  return database;
}

export function ensureDatabase(): Promise<void> {
  initialization ??= initializeDatabase().catch((error) => {
    initialization = null;
    throw error;
  });
  return initialization;
}

async function initializeDatabase(): Promise<void> {
  const db = getD1();
  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS roles (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      permission TEXT NOT NULL,
      UNIQUE(role, permission)
    )`,
    `CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      phone TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      channel_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    "CREATE INDEX IF NOT EXISTS sessions_account_idx ON sessions(account_id)",
    "CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at)",
    `CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      account_id TEXT NOT NULL UNIQUE,
      parent_channel_id TEXT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      region TEXT NOT NULL DEFAULT '',
      contact_name TEXT NOT NULL DEFAULT '',
      contact_phone TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      target_rate INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    "CREATE INDEX IF NOT EXISTS channels_parent_idx ON channels(parent_channel_id)",
    `CREATE TABLE IF NOT EXISTS end_users (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      tag TEXT NOT NULL DEFAULT '新用户',
      level TEXT NOT NULL DEFAULT '普通用户',
      product TEXT NOT NULL DEFAULT '未购买',
      recharge_amount INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      invited_by_account_id TEXT NOT NULL,
      owner_channel_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    "CREATE INDEX IF NOT EXISTS users_owner_channel_idx ON end_users(owner_channel_id)",
    "CREATE INDEX IF NOT EXISTS users_inviter_idx ON end_users(invited_by_account_id)",
    `CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      inviter_account_id TEXT NOT NULL,
      target_role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      max_uses INTEGER NOT NULL DEFAULT 0,
      use_count INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    "CREATE INDEX IF NOT EXISTS invitations_inviter_idx ON invitations(inviter_account_id)",
    `CREATE TABLE IF NOT EXISTS invitation_bindings (
      id TEXT PRIMARY KEY,
      invitation_id TEXT NOT NULL,
      invitee_type TEXT NOT NULL,
      invitee_id TEXT NOT NULL,
      inviter_account_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    "CREATE INDEX IF NOT EXISTS bindings_invitation_idx ON invitation_bindings(invitation_id)",
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_account_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      detail TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    "CREATE INDEX IF NOT EXISTS audit_actor_idx ON audit_logs(actor_account_id)",
    `CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id TEXT PRIMARY KEY,
      requester_account_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      method TEXT NOT NULL,
      account_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      remark TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by TEXT,
      reviewed_at TEXT,
      review_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    "CREATE INDEX IF NOT EXISTS withdrawals_requester_idx ON withdrawal_requests(requester_account_id)",
    "CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON withdrawal_requests(status)",
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_account_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      related_type TEXT,
      related_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    "CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications(recipient_account_id, is_read, created_at)",
    `CREATE TABLE IF NOT EXISTS file_assets (
      id TEXT PRIMARY KEY,
      uploader_account_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      storage_key TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      storage_backend TEXT NOT NULL DEFAULT 'd1',
      content BLOB,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    "CREATE INDEX IF NOT EXISTS file_assets_uploader_idx ON file_assets(uploader_account_id, created_at)",
    `CREATE TABLE IF NOT EXISTS system_configs (
      config_key TEXT PRIMARY KEY,
      config_value TEXT NOT NULL,
      value_type TEXT NOT NULL DEFAULT 'string',
      description TEXT NOT NULL DEFAULT '',
      updated_by TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS backup_runs (
      id TEXT PRIMARY KEY,
      created_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      table_count INTEGER NOT NULL DEFAULT 0,
      record_count INTEGER NOT NULL DEFAULT 0,
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )`,
    "CREATE INDEX IF NOT EXISTS backup_runs_created_idx ON backup_runs(created_at)",
  ];
  for (const statement of schemaStatements) await db.prepare(statement).run();

  await seedRolesAndPermissions(db);
  await seedDevelopmentAccounts(db);
  await db.prepare("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP").run();
}

async function seedRolesAndPermissions(db: D1Database): Promise<void> {
  const roles = [
    ["super_admin", "超级管理员", 100],
    ["market", "市场端", 80],
    ["franchise", "加盟端", 60],
    ["agent", "代理端", 40],
  ] as const;
  const permissions: Record<string, string[]> = {
    super_admin: ["account.read", "account.write", "channel.read", "channel.write", "user.read", "user.write", "invitation.read", "invitation.write", "withdrawal.read", "withdrawal.write", "approval.read", "approval.write", "notification.read", "notification.write", "audit.read", "file.read", "file.write", "report.read", "config.read", "config.write", "backup.read", "backup.write"],
    market: ["account.read", "channel.read", "channel.write", "user.read", "user.write", "invitation.read", "invitation.write", "withdrawal.read", "approval.read", "approval.write", "notification.read", "notification.write", "audit.read", "file.read", "file.write", "report.read", "config.read", "backup.read"],
    franchise: ["channel.read", "user.read", "invitation.read", "invitation.write", "withdrawal.read", "withdrawal.write", "notification.read", "notification.write", "file.read", "file.write", "report.read"],
    agent: ["user.read", "invitation.read", "invitation.write", "withdrawal.read", "withdrawal.write", "notification.read", "notification.write", "file.read", "file.write", "report.read"],
  };
  const statements: D1PreparedStatement[] = roles.map(([code, name, level]) =>
    db.prepare("INSERT OR IGNORE INTO roles (code, name, level) VALUES (?, ?, ?)").bind(code, name, level),
  );
  for (const [role, values] of Object.entries(permissions)) {
    for (const permission of values) {
      statements.push(db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)").bind(role, permission));
    }
  }
  await db.batch(statements);
}

async function seedDevelopmentAccounts(db: D1Database): Promise<void> {
  const existing = await db.prepare("SELECT id FROM accounts LIMIT 1").first();
  if (existing) return;

  const [adminHash, marketHash, franchiseHash, agentHash] = await Promise.all([
    hashPassword("Admin@123456"),
    hashPassword("Market@123456"),
    hashPassword("Franchise@123456"),
    hashPassword("Agent@123456"),
  ]);

  await db.batch([
    db.prepare("INSERT INTO accounts (id, username, phone, password_hash, role, display_name, channel_id) VALUES (?, ?, ?, ?, ?, ?, ?)").bind("acc_super", "admin", "13800000000", adminHash, "super_admin", "官方总部", null),
    db.prepare("INSERT INTO accounts (id, username, phone, password_hash, role, display_name, channel_id) VALUES (?, ?, ?, ?, ?, ?, ?)").bind("acc_market", "market", "13800000001", marketHash, "market", "市场端·李珊", "chn_market"),
    db.prepare("INSERT INTO accounts (id, username, phone, password_hash, role, display_name, channel_id) VALUES (?, ?, ?, ?, ?, ?, ?)").bind("acc_franchise", "franchise", "13800000002", franchiseHash, "franchise", "华东加盟中心", "chn_franchise"),
    db.prepare("INSERT INTO accounts (id, username, phone, password_hash, role, display_name, channel_id) VALUES (?, ?, ?, ?, ?, ?, ?)").bind("acc_agent", "agent", "13800000003", agentHash, "agent", "星河创作社", "chn_agent"),
  ]);

  await db.batch([
    db.prepare("INSERT INTO channels (id, code, account_id, parent_channel_id, name, role, region, contact_name, contact_phone, target_rate, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("chn_market", "A-001", "acc_market", null, "全国市场中心", "market", "全国", "李珊", "13800000001", 92, "acc_super", "2026-01-02 09:00:00", "2026-01-02 09:00:00"),
    db.prepare("INSERT INTO channels (id, code, account_id, parent_channel_id, name, role, region, contact_name, contact_phone, target_rate, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("chn_franchise", "B-001", "acc_franchise", "chn_market", "华东加盟中心", "franchise", "上海/浙江", "张经理", "13800000002", 91, "acc_market", "2026-01-08 10:00:00", "2026-01-08 10:00:00"),
    db.prepare("INSERT INTO channels (id, code, account_id, parent_channel_id, name, role, region, contact_name, contact_phone, target_rate, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("chn_agent", "C-001", "acc_agent", "chn_franchise", "星河创作社", "agent", "上海", "王总", "13800000003", 84, "acc_franchise", "2026-07-10 10:00:00", "2026-07-10 10:00:00"),
  ]);

  await db.batch([
    db.prepare("INSERT INTO end_users (id, code, name, phone, email, status, tag, level, product, recharge_amount, note, invited_by_account_id, owner_channel_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("usr_demo_1", "U-1001", "林晚", "13900001001", "linwan@example.com", "active", "成长会员", "进阶创作者", "成长会员", 4990, "邀请注册演示用户", "acc_agent", "chn_agent", "2026-08-04 11:22:00", "2026-08-04 11:22:00"),
    db.prepare("INSERT INTO end_users (id, code, name, phone, email, status, tag, level, product, recharge_amount, note, invited_by_account_id, owner_channel_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("usr_demo_2", "U-1002", "顾青", "13900001002", "guqing@example.com", "active", "课程潜客", "普通用户", "未购买", 0, "待跟进", "acc_franchise", "chn_franchise", "2026-08-04 10:08:00", "2026-08-04 10:08:00"),
  ]);
}

export async function writeAudit(
  actorAccountId: string | null,
  action: string,
  targetType: string,
  targetId: string | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const db = getD1();
  await db.prepare("INSERT INTO audit_logs (id, actor_account_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), actorAccountId, action, targetType, targetId, JSON.stringify(detail))
    .run();
}