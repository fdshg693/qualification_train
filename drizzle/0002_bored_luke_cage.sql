CREATE TABLE "mock_exam_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"genre" text NOT NULL,
	"keyword_names" jsonb NOT NULL,
	"question_count" integer NOT NULL,
	"questions_by_keyword" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
