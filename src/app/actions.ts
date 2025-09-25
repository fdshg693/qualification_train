'use server'

import { db } from '@/db/client'
import { questions, genres, subgenres, prompts, keywords } from '@/db/schema'
import { eq, and, like, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'

type SaveParams = {
    genre: string
    topic?: string
    question: string
    choices: string[]
    answerIndexes: number[]
    explanations: string[]
}

export async function saveQuestion(params: SaveParams) {
    const choices = Array.isArray(params.choices) ? params.choices.filter((s) => typeof s === 'string') : []
    const explanations = Array.isArray(params.explanations) ? params.explanations.filter((s) => typeof s === 'string') : []
    // ensure explanations length matches choices length
    while (explanations.length < choices.length) explanations.push('')
    if (explanations.length > choices.length) explanations.splice(choices.length)
    const maxIdx = Math.max(0, choices.length - 1)
    const answers = Array.from(new Set((params.answerIndexes ?? []).filter((i) => i >= 0 && i <= maxIdx))).sort((a,b)=>a-b)
    await db.insert(questions).values({
        genre: params.genre,
        topic: params.topic ?? null,
        question: params.question,
        choices,
        answers,
        explanation: explanations,
    })
}

export async function listQuestions(opts?: { genre?: string; q?: string }) {
    const { genre, q } = opts ?? {}
    const where = [
        genre ? eq(questions.genre, genre) : undefined,
        q ? like(questions.question, `%${q}%`) : undefined,
    ].filter(Boolean) as any[]
    const rows = await db
        .select()
        .from(questions)
        .where(where.length ? (and as any)(...where) : undefined)
        .orderBy(questions.createdAt)
    return rows
}

// ランダムな1件の問題を取得（練習用）
export async function getRandomQuestion() {
    // Postgres の random() を利用し1件取得
    const row = await db.select().from(questions).orderBy(sql`random()`).limit(1)
    if (!row.length) return null
    const q = row[0]
    return {
        id: q.id,
        genre: q.genre,
        topic: q.topic ?? undefined,
        question: q.question,
        choices: (q.choices as string[]) ?? [],
        answerIndexes: ((q.answers as number[]) ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < ((q.choices as string[]) ?? []).length),
        explanations: (q.explanation as string[]) ?? [],
        createdAt: q.createdAt,
    }
}

// ===== Genres (ジャンル) =====
export async function listGenres() {
    const rows = await db.select().from(genres).orderBy(genres.createdAt)
    return rows
}

export async function createGenre(name: string) {
    if (!name || !name.trim()) return
    await db.insert(genres).values({ name: name.trim() })
    revalidatePath('/admin/genres')
    revalidatePath('/')
    revalidatePath('/saved')
}

export async function updateGenre(id: number, name: string) {
    if (!id || !name?.trim()) return
    await db.update(genres).set({ name: name.trim() }).where(eq(genres.id, id))
    revalidatePath('/admin/genres')
    revalidatePath('/')
    revalidatePath('/saved')
}

export async function deleteGenre(id: number) {
    if (!id) return
    await db.delete(genres).where(eq(genres.id, id))
    revalidatePath('/admin/genres')
    revalidatePath('/')
    revalidatePath('/saved')
}

export async function deleteQuestion(id: number) {
    if (!id) return
    await db.delete(questions).where(eq(questions.id, id))
    // Revalidate pages that list questions
    revalidatePath('/saved')
    revalidatePath('/')
    revalidatePath('/practice')
}

// ===== Subgenres (サブジャンル) =====
export async function listSubgenres(opts?: { genreId?: number }) {
    const { genreId } = opts ?? {}
    const rows = await db
        .select()
        .from(subgenres)
        .where(genreId ? eq(subgenres.genreId, genreId) : undefined as any)
        .orderBy(subgenres.createdAt)
    return rows
}

export async function createSubgenre(genreId: number, name: string) {
    if (!genreId || !name?.trim()) return
    await db.insert(subgenres).values({ genreId, name: name.trim() })
    revalidatePath('/admin/genres')
    revalidatePath('/')
}

export async function updateSubgenre(id: number, name: string) {
    if (!id || !name?.trim()) return
    await db.update(subgenres).set({ name: name.trim() }).where(eq(subgenres.id, id))
    revalidatePath('/admin/genres')
    revalidatePath('/')
}

export async function deleteSubgenre(id: number) {
    if (!id) return
    await db.delete(subgenres).where(eq(subgenres.id, id))
    revalidatePath('/admin/genres')
    revalidatePath('/')
}

// ===== Prompts (テンプレート) =====
const DEFAULT_PROMPT_NAME = 'default'
import { DEFAULT_PROMPT_TEMPLATE, DEFAULT_SYSTEM_PROMPT } from '@/lib/default-prompts'

export async function getPrompt(name?: string) {
    const n = (name || DEFAULT_PROMPT_NAME).trim()
    try {
        const rows = await db.select().from(prompts).where(eq(prompts.name, n))
        if (rows.length) return rows[0]
    } catch (e) {
        console.warn('[prompts] テーブル未作成または取得エラー。デフォルトを使用します。', e)
    }
    // 無ければデフォルトを返す（DB未作成時も扱えるよう仮想オブジェクト）
    return { id: 0, name: n, template: DEFAULT_PROMPT_TEMPLATE, system: DEFAULT_SYSTEM_PROMPT, createdAt: new Date() } as any
}

export async function setPrompt(name: string, template: string, system?: string) {
    const n = (name || DEFAULT_PROMPT_NAME).trim()
    const t = (template || '').trim()
    const s = (system || '').trim()
    if (!t) return
    const existing = await db.select().from(prompts).where(eq(prompts.name, n))
    if (existing.length) {
        await db.update(prompts).set({ template: t, system: s || null }).where(eq(prompts.id, existing[0].id))
    } else {
        await db.insert(prompts).values({ name: n, template: t, system: s || null })
    }
    revalidatePath('/admin/prompts')
    revalidatePath('/')
}

// List all prompts
export async function listPrompts() {
    try {
        const rows = await db.select().from(prompts).orderBy(prompts.createdAt)
        return rows
    } catch (e) {
        // テーブル未作成などの場合は空配列
        return []
    }
}

// Save (create/update) a prompt. If id provided, update that row; otherwise upsert by name.
export async function savePrompt(params: { id?: number; name: string; template: string; system?: string }) {
    const id = params.id
    const name = (params.name || DEFAULT_PROMPT_NAME).trim()
    const template = (params.template || '').trim()
    const system = (params.system || '').trim()
    if (!template) return
    if (id && id > 0) {
        await db.update(prompts).set({ name, template, system: system || null }).where(eq(prompts.id, id))
    } else {
        // fallback to name-based upsert
        const existing = await db.select().from(prompts).where(eq(prompts.name, name))
        if (existing.length) {
            await db.update(prompts).set({ template, system: system || null }).where(eq(prompts.id, existing[0].id))
        } else {
            await db.insert(prompts).values({ name, template, system: system || null })
        }
    }
    revalidatePath('/admin/prompts')
    revalidatePath('/')
}

// Delete a prompt by id
export async function deletePrompt(id: number) {
    if (!id) return
    await db.delete(prompts).where(eq(prompts.id, id))
    revalidatePath('/admin/prompts')
    revalidatePath('/')
}

// ===== Keywords (キーワード) =====
export async function listKeywords(opts?: { genreId?: number; parentId?: number | null }) {
    const genreId = opts?.genreId
    const parentId = opts?.parentId
    const where = [
        genreId ? eq(keywords.genreId, genreId) : undefined,
        parentId === null ? sql`"parent_id" IS NULL` : (Number.isFinite(parentId as any) ? eq(keywords.parentId, parentId as number) : undefined),
    ].filter(Boolean) as any
    const rows = await db
        .select()
        .from(keywords)
        .where(where.length ? (and as any)(...where) : undefined)
        .orderBy(keywords.createdAt)
    return rows
}

export async function createKeyword(genreId: number, name: string, parentId?: number | null) {
    if (!genreId || !name?.trim()) return
    let pid: number | null = parentId ?? null
    if (pid) {
        const parent = await getKeyword(pid)
        if (!parent || parent.genreId !== genreId) pid = null
    }
    try {
        await db.insert(keywords).values({ genreId, name: name.trim(), parentId: pid })
    } catch { /* ignore duplicates by unique index */ }
    revalidatePath('/admin/keywords')
}

export async function updateKeyword(id: number, name: string) {
    if (!id || !name?.trim()) return
    await db.update(keywords).set({ name: name.trim() }).where(eq(keywords.id, id))
    revalidatePath('/admin/keywords')
}

export async function deleteKeyword(id: number) {
    if (!id) return
    await db.delete(keywords).where(eq(keywords.id, id))
    revalidatePath('/admin/keywords')
}

export async function toggleKeywordExcluded(id: number) {
    if (!id) return
    // 反転更新（Postgres式: excluded = NOT excluded）
    await db.execute(sql`UPDATE "keywords" SET "excluded" = NOT "excluded" WHERE "id" = ${id}`)
    revalidatePath('/admin/keywords')
}

// キーワード1件取得

export async function getKeyword(id: number) {
    if (!id) return null
    const rows = await db.select().from(keywords).where(eq(keywords.id, id))
    return rows[0] ?? null
}

// AI によるキーワード自動生成（親子対応）
const KeywordsSchema = z.object({ keywords: z.array(z.string()).min(1).max(200) })

export async function generateKeywords(params: { genreId?: number; parentId?: number | null; limit: number }) {
    const { genreId: rawGenreId, parentId } = params
    const limit = Math.max(1, Math.min(200, Math.floor(params.limit || 20)))
    let genreId = rawGenreId || 0
    let contextName = ''
    let mode: 'genre' | 'child' = 'genre'
    if (parentId && parentId > 0) {
        const parent = await getKeyword(parentId)
        if (!parent) return [] as string[]
        genreId = parent.genreId
        contextName = parent.name
        mode = 'child'
    }
    if (!genreId) return [] as string[]
    const gs = await db.select().from(genres).where(eq(genres.id, genreId))
    if (!gs.length) return []
    const genreName = gs[0].name
    const apiKey = process.env.OPENAI_API_KEY
    let list: string[] = []
    if (!apiKey) {
        // Mock: deterministic placeholders
        list = Array.from({ length: limit }, (_, i) => mode === 'child' ? `${contextName}の子${i + 1}` : `${genreName}キーワード${i + 1}`)
    } else {
        const openai = createOpenAI({ apiKey })
        const { object } = await generateObject({
            model: openai('gpt-4.1'),
            system: 'あなたは階層的なキーワード体系を構築するアシスタントです。重複や言い換えは避け、短い名詞句で出力してください。出力はJSONのみ。',
            prompt: [
                `ジャンル: ${genreName}`,
                mode === 'child' ? `親キーワード: ${contextName}` : 'トップレベルを網羅',
                `上限数: ${limit}`,
                mode === 'child'
                    ? '指定した親キーワードの直下の子キーワード候補を列挙してください。粒度は親の下位概念となるように。'
                    : 'ジャンル全体をなるべくカバーするように多様なトピックからトップレベルのキーワードを列挙してください。',
                '各要素は1～5語程度の短い名詞句とし、JSONのみで返してください。キーは "keywords"、値は配列です。'
            ].join('\n'),
            schema: KeywordsSchema,
        })
        list = (object.keywords || []).slice(0, limit)
    }
    // 既存を取得して差分のみ追加
    const existing = await db
        .select()
        .from(keywords)
        .where(and(eq(keywords.genreId, genreId), parentId ? eq(keywords.parentId, parentId) : sql`"parent_id" IS NULL`))
    const exSet = new Set(existing.map((k) => k.name))
    const unique = list.map((s) => s.trim()).filter((s) => s && !exSet.has(s))
    if (unique.length) {
        // bulk insert; ignore duplicates
        for (const name of unique) {
            try { await db.insert(keywords).values({ genreId, name, parentId: parentId ?? null }) } catch {}
        }
        revalidatePath('/admin/keywords')
    }
    return list
}
