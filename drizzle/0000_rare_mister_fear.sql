CREATE TABLE `genres` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `genres_name_unique` ON `genres` (`name`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`genre` text NOT NULL,
	`topic` text,
	`question` text NOT NULL,
	`choices_json` text NOT NULL,
	`answers_json` text NOT NULL,
	`explanation` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')*1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subgenres` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`genre_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')*1000) NOT NULL,
	FOREIGN KEY (`genre_id`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subgenres_genre_id_name_unique` ON `subgenres` (`genre_id`,`name`);