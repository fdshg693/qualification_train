import { pgTable, serial, text, integer, timestamp, jsonb, uniqueIndex, boolean as pgBoolean } from 'drizzle-orm/pg-core'

export const genres = pgTable('genres', {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
})

export type InsertGenre = typeof genres.$inferInsert
export type SelectGenre = typeof genres.$inferSelect

export const questions = pgTable('questions', {
    id: serial('id').primaryKey(),
    genre: text('genre').notNull(),
    question: text('question').notNull(),
    choices: jsonb('choices').$type<string[]>().notNull(),
    answers: jsonb('answers').$type<number[]>().notNull(),
    explanation: jsonb('explanation').$type<string[]>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
})

export type InsertQuestion = typeof questions.$inferInsert
export type SelectQuestion = typeof questions.$inferSelect

// ===== Mock exam aggregated sets =====
export const mockExamSets = pgTable('mock_exam_sets', {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    genre: text('genre').notNull(),
    keywordNames: jsonb('keyword_names').$type<string[]>().notNull(),
    questionCount: integer('question_count').notNull(),
    questionsByKeyword: jsonb('questions_by_keyword').$type<Array<{ keyword: string; questions: {
        question: string
        choices: string[]
        answerIndexes: number[]
        explanations: string[]
    }[] }>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
})

export type InsertMockExamSet = typeof mockExamSets.$inferInsert
export type SelectMockExamSet = typeof mockExamSets.$inferSelect

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
        // 親キーワード（ツリー構造）。トップレベルは NULL。
    parentId: integer('parent_id').references(((): any => keywords.id), { onDelete: 'cascade' }),
        name: text('name').notNull(),
        // 除外フラグ（除外中のキーワードは問題生成時に回避する）
        excluded: pgBoolean('excluded').notNull().default(false),
        createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
    },
    (t) => ({
        // 同一親配下（親NULL含む）での重複名を抑止する目的の一意制約
        // 注意: parent_id に NULL が含まれる行同士は Postgres では重複と見なされないため、
        // トップレベルで完全な一意性を強制したい場合はアプリ側でのチェックも併用します。
        keywordsGenreParentNameUnique: uniqueIndex('keywords_genre_parent_name_unique').on(t.genreId, t.parentId, t.name),
    })
)

export type InsertKeyword = typeof keywords.$inferInsert
export type SelectKeyword = typeof keywords.$inferSelect
