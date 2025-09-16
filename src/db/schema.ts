import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
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
