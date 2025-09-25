import { pgTable, serial, text, integer, timestamp, jsonb, uniqueIndex, boolean as pgBoolean } from 'drizzle-orm/pg-core'

export const genres = pgTable('genres', {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
})

export type InsertGenre = typeof genres.$inferInsert
export type SelectGenre = typeof genres.$inferSelect

export const subgenres = pgTable(
    'subgenres',
    {
        id: serial('id').primaryKey(),
        genreId: integer('genre_id').notNull().references(() => genres.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
    },
    (t) => ({
        subgenresGenreIdNameUnique: uniqueIndex('subgenres_genre_id_name_unique').on(t.genreId, t.name),
    })
)

export type InsertSubgenre = typeof subgenres.$inferInsert
export type SelectSubgenre = typeof subgenres.$inferSelect

export const questions = pgTable('questions', {
    id: serial('id').primaryKey(),
    genre: text('genre').notNull(),
    topic: text('topic'),
    question: text('question').notNull(),
    choices: jsonb('choices').$type<string[]>().notNull(),
    answers: jsonb('answers').$type<number[]>().notNull(),
    explanation: jsonb('explanation').$type<string[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
})

export type InsertQuestion = typeof questions.$inferInsert
export type SelectQuestion = typeof questions.$inferSelect

// ===== Prompts (for prompt template management) =====
export const prompts = pgTable('prompts', {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    template: text('template').notNull(),
    // Optional system prompt for model instructions
    system: text('system'),
    createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
})

export type InsertPrompt = typeof prompts.$inferInsert
export type SelectPrompt = typeof prompts.$inferSelect

// ===== Keywords (genre-scoped keywords for coverage) =====
export const keywords = pgTable(
    'keywords',
    {
        id: serial('id').primaryKey(),
        genreId: integer('genre_id').notNull().references(() => genres.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        // 除外フラグ（除外中のキーワードは問題生成時に回避する）
        excluded: pgBoolean('excluded').notNull().default(false),
        createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
    },
    (t) => ({
        keywordsGenreIdNameUnique: uniqueIndex('keywords_genre_id_name_unique').on(t.genreId, t.name),
    })
)

export type InsertKeyword = typeof keywords.$inferInsert
export type SelectKeyword = typeof keywords.$inferSelect
