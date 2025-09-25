CREATE TABLE "keywords" (
    "id" serial PRIMARY KEY NOT NULL,
    "genre_id" integer NOT NULL,
    "name" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "keywords_genre_id_name_unique" ON "keywords" USING btree ("genre_id","name");
