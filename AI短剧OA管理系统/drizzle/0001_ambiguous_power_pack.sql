CREATE TABLE `backup_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_by` text NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`table_count` integer DEFAULT 0 NOT NULL,
	`record_count` integer DEFAULT 0 NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `file_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`uploader_account_id` text NOT NULL,
	`original_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`checksum` text NOT NULL,
	`storage_backend` text DEFAULT 'd1' NOT NULL,
	`content` blob,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `file_assets_storage_key_unique` ON `file_assets` (`storage_key`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_account_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`related_type` text,
	`related_id` text,
	`is_read` integer DEFAULT 0 NOT NULL,
	`read_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_configs` (
	`config_key` text PRIMARY KEY NOT NULL,
	`config_value` text NOT NULL,
	`value_type` text DEFAULT 'string' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`updated_by` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `withdrawal_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_account_id` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`account_name` text NOT NULL,
	`account_number` text NOT NULL,
	`remark` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`review_note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
