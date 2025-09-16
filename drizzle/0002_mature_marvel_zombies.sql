CREATE TABLE `subgenres` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`genre_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')*1000) NOT NULL,
	FOREIGN KEY (`genre_id`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subgenres_genre_id_name_unique` ON `subgenres` (`genre_id`,`name`);