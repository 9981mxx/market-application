CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`phone` text,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`channel_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_username_unique` ON `accounts` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_phone_unique` ON `accounts` (`phone`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_account_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`detail` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`account_id` text NOT NULL,
	`parent_channel_id` text,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`contact_phone` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`target_rate` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channels_code_unique` ON `channels` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `channels_account_id_unique` ON `channels` (`account_id`);--> statement-breakpoint
CREATE TABLE `end_users` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`tag` text DEFAULT '新用户' NOT NULL,
	`level` text DEFAULT '普通用户' NOT NULL,
	`product` text DEFAULT '未购买' NOT NULL,
	`recharge_amount` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`invited_by_account_id` text NOT NULL,
	`owner_channel_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `end_users_code_unique` ON `end_users` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `end_users_phone_unique` ON `end_users` (`phone`);--> statement-breakpoint
CREATE TABLE `invitation_bindings` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text NOT NULL,
	`invitee_type` text NOT NULL,
	`invitee_id` text NOT NULL,
	`inviter_account_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`inviter_account_id` text NOT NULL,
	`target_role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`max_uses` integer DEFAULT 0 NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_code_unique` ON `invitations` (`code`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role` text NOT NULL,
	`permission` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`level` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);