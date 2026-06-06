CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` integer NOT NULL,
	`action` text NOT NULL,
	`target` text DEFAULT '' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `broadcasts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`by_id` integer NOT NULL,
	`audience` text NOT NULL,
	`game_id` integer,
	`text` text NOT NULL,
	`sent_to` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_stats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`goals` integer DEFAULT 0 NOT NULL,
	`assists` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'organizer' NOT NULL,
	`confirmed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stats_game_user` ON `game_stats` (`game_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text DEFAULT 'game' NOT NULL,
	`title` text NOT NULL,
	`starts_at` integer NOT NULL,
	`deadline_at` integer,
	`venue_id` integer NOT NULL,
	`aside` integer,
	`main_slots` integer DEFAULT 0 NOT NULL,
	`sub_slots` integer DEFAULT 0 NOT NULL,
	`capacity` integer,
	`price` integer DEFAULT 0 NOT NULL,
	`pay_when` text DEFAULT 'signup' NOT NULL,
	`split_mode` text DEFAULT 'auto' NOT NULL,
	`approval` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`cancelled_at` integer,
	`started_at` integer,
	`paused_at` integer,
	`paused_total` integer DEFAULT 0 NOT NULL,
	`finished_at` integer,
	`score_a` integer DEFAULT 0 NOT NULL,
	`score_b` integer DEFAULT 0 NOT NULL,
	`teams_published_at` integer,
	`draft` text,
	`reminded_at` integer,
	`season_id` integer,
	`series_id` integer,
	`created_by` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `games_starts_at` ON `games` (`starts_at`);--> statement-breakpoint
CREATE INDEX `games_series` ON `games` (`series_id`);--> statement-breakpoint
CREATE TABLE `match_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`minute` integer DEFAULT 0 NOT NULL,
	`team` text NOT NULL,
	`scorer_id` integer,
	`assist_id` integer,
	`own_goal` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_game` ON `match_events` (`game_id`);--> statement-breakpoint
CREATE TABLE `moderation` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`kind` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`by_id` integer NOT NULL,
	`lifted_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mvp_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`voter_id` integer NOT NULL,
	`votee_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mvp_game_voter` ON `mvp_votes` (`game_id`,`voter_id`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`path` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `photos_game` ON `photos` (`game_id`);--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`auto` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`decided_at` integer
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `series` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`days` text DEFAULT '[]' NOT NULL,
	`time` text DEFAULT '18:00' NOT NULL,
	`venue_id` integer NOT NULL,
	`aside` integer DEFAULT 5 NOT NULL,
	`sub_slots` integer DEFAULT 2 NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`open_days_before` integer DEFAULT 5 NOT NULL,
	`invite_regulars` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text DEFAULT 'Lineup' NOT NULL,
	`currency` text DEFAULT 'Kč' NOT NULL,
	`pts_attend` integer DEFAULT 2 NOT NULL,
	`pts_win` integer DEFAULT 3 NOT NULL,
	`pts_goal` integer DEFAULT 1 NOT NULL,
	`pts_assist` integer DEFAULT 1 NOT NULL,
	`pts_mvp` integer DEFAULT 2 NOT NULL,
	`cancel_deadline_hours` integer DEFAULT 2 NOT NULL,
	`no_show_penalty` integer DEFAULT 5 NOT NULL,
	`min_reliability` integer DEFAULT 0 NOT NULL,
	`cash_enabled` integer DEFAULT true NOT NULL,
	`qr_recipient` text DEFAULT '' NOT NULL,
	`qr_account` text DEFAULT '' NOT NULL,
	`qr_bank` text DEFAULT '' NOT NULL,
	`qr_note` text DEFAULT 'Взнос за игру · {название}' NOT NULL,
	`qr_image` text DEFAULT '' NOT NULL,
	`qr_auto_confirm` integer DEFAULT false NOT NULL,
	`auto_refund` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`position` text,
	`guests` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`team` text,
	`pay_status` text DEFAULT 'none' NOT NULL,
	`pay_method` text,
	`checked_in` integer DEFAULT false NOT NULL,
	`late_cancel` integer DEFAULT false NOT NULL,
	`no_show` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`cancelled_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signups_game_user` ON `signups` (`game_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `signups_user` ON `signups` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tg_id` integer NOT NULL,
	`first` text DEFAULT '' NOT NULL,
	`last` text DEFAULT '' NOT NULL,
	`handle` text DEFAULT '' NOT NULL,
	`photo_url` text DEFAULT '' NOT NULL,
	`primary_pos` text,
	`fallback_pos` text DEFAULT '[]' NOT NULL,
	`foot` text,
	`level` integer DEFAULT 3 NOT NULL,
	`area` text DEFAULT '' NOT NULL,
	`kit_size` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'player' NOT NULL,
	`onboarded_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_tg_id` ON `users` (`tg_id`);--> statement-breakpoint
CREATE TABLE `venues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`addr` text DEFAULT '' NOT NULL,
	`rent` integer DEFAULT 0 NOT NULL,
	`balls` integer DEFAULT 0 NOT NULL,
	`bibs` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL
);
