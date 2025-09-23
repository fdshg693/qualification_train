CREATE TABLE "prompts" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "template" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "prompts_name_unique" UNIQUE("name")
);
