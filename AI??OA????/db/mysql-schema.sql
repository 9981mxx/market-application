CREATE TABLE IF NOT EXISTS roles (
  code VARCHAR(32) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  level INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  role VARCHAR(32) NOT NULL,
  permission VARCHAR(64) NOT NULL,
  UNIQUE KEY role_permissions_role_permission_uq (role, permission)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(128) NOT NULL,
  phone VARCHAR(32) NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(32) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  channel_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY accounts_username_uq (username),
  UNIQUE KEY accounts_phone_uq (phone),
  KEY accounts_role_idx (role),
  KEY accounts_channel_idx (channel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(64) PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY sessions_token_hash_uq (token_hash),
  KEY sessions_account_idx (account_id),
  KEY sessions_expires_idx (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS channels (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  account_id VARCHAR(64) NOT NULL,
  parent_channel_id VARCHAR(64) NULL,
  name VARCHAR(128) NOT NULL,
  role VARCHAR(32) NOT NULL,
  region VARCHAR(255) NOT NULL DEFAULT '',
  contact_name VARCHAR(128) NOT NULL DEFAULT '',
  contact_phone VARCHAR(32) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  target_rate INT NOT NULL DEFAULT 0,
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY channels_code_uq (code),
  UNIQUE KEY channels_account_uq (account_id),
  KEY channels_parent_idx (parent_channel_id),
  KEY channels_role_idx (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS end_users (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(255) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  tag VARCHAR(64) NOT NULL DEFAULT '新用户',
  level VARCHAR(64) NOT NULL DEFAULT '普通用户',
  product VARCHAR(128) NOT NULL DEFAULT '未购买',
  recharge_amount BIGINT NOT NULL DEFAULT 0,
  note TEXT NOT NULL,
  invited_by_account_id VARCHAR(64) NOT NULL,
  owner_channel_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY end_users_code_uq (code),
  UNIQUE KEY end_users_phone_uq (phone),
  KEY end_users_owner_channel_idx (owner_channel_id),
  KEY end_users_inviter_idx (invited_by_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS invitations (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(128) NOT NULL,
  inviter_account_id VARCHAR(64) NOT NULL,
  target_role VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  max_uses INT NOT NULL DEFAULT 0,
  use_count INT NOT NULL DEFAULT 0,
  expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY invitations_code_uq (code),
  KEY invitations_inviter_idx (inviter_account_id),
  KEY invitations_status_idx (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS invitation_bindings (
  id VARCHAR(64) PRIMARY KEY,
  invitation_id VARCHAR(64) NOT NULL,
  invitee_type VARCHAR(32) NOT NULL,
  invitee_id VARCHAR(64) NOT NULL,
  inviter_account_id VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY invitation_bindings_invitation_idx (invitation_id),
  KEY invitation_bindings_invitee_idx (invitee_type, invitee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  actor_account_id VARCHAR(64) NULL,
  action VARCHAR(128) NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(64) NULL,
  detail JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY audit_logs_actor_idx (actor_account_id),
  KEY audit_logs_target_idx (target_type, target_id),
  KEY audit_logs_created_at_idx (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS data_sync_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source_type VARCHAR(32) NOT NULL,
  source_path VARCHAR(512) NOT NULL,
  row_counts JSON NOT NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;