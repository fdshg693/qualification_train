import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const questions = sqliteTable('questions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    genre: text('genre').notNull(),
    topic: text('topic'),
    question: text('question').notNull(),
    choice0: text('choice0').notNull(),
    choice1: text('choice1').notNull(),
    choice2: text('choice2').notNull(),
    choice3: text('choice3').notNull(),
    answerIndex: integer('answer_index').notNull(),
    explanation: text('explanation').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(strftime('%s','now')*1000)`),
})

export type InsertQuestion = typeof questions.$inferInsert
export type SelectQuestion = typeof questions.$inferSelect

// ジャンル管理テーブル（管理画面から追加・編集）
export const genres = sqliteTable('genres', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(strftime('%s','now')*1000)`),
})

export type InsertGenre = typeof genres.$inferInsert
export type SelectGenre = typeof genres.$inferSelect

// サブジャンル管理テーブル（ジャンルに紐づく）
export const subgenres = sqliteTable(
    'subgenres',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        genreId: integer('genre_id').notNull().references(() => genres.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        createdAt: integer('created_at', { mode: 'timestamp_ms' })
            .notNull()
            .default(sql`(strftime('%s','now')*1000)`),
    },
    (t) => ({
        subgenresGenreIdNameUnique: uniqueIndex('subgenres_genre_id_name_unique').on(t.genreId, t.name),
    })
)

export type InsertSubgenre = typeof subgenres.$inferInsert
export type SelectSubgenre = typeof subgenres.$inferSelect
