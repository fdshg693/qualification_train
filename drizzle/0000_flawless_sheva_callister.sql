CREATE TABLE IF NOT EXISTS `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`genre` text NOT NULL,
	`topic` text,
	`question` text NOT NULL,
	`choice0` text NOT NULL,
	`choice1` text NOT NULL,
	`choice2` text NOT NULL,
	`choice3` text NOT NULL,
	`answer_index` integer NOT NULL,
	`explanation` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now')*1000) NOT NULL
);
