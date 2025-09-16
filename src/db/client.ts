import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

const sqlite = new Database('sqlite.db')

// Ensure genres table exists (id, name unique, created_at)
sqlite.exec(`
CREATE TABLE IF NOT EXISTS "genres" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"name" text NOT NULL UNIQUE,
	"created_at" integer NOT NULL DEFAULT (strftime('%s','now')*1000)
);
`)

export const db = drizzle(sqlite)
