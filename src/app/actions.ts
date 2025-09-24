'use server'

import { db } from '@/db/client'
import { questions, genres, subgenres, prompts } from '@/db/schema'
import { eq, and, like, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

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
const DEFAULT_PROMPT_TEMPLATE = `あなたはプロの出題者です。以下の条件を満たす多肢選択式の問題を作成してください。

ジャンル: {genre}
サブジャンル: {subgenre}
トピック: {topic}
問題数: {count}
選択肢数（各問）: {choiceCount}
正解数（各問）: {minCorrect}〜{maxCorrect}

要件:
- 問題文は日本語で簡潔に。
- 選択肢は {choiceCount} 個、曖昧さを避ける。
- 正解は複数でも可。
- 初学者にも分かる短い解説を各選択肢ごとに付ける。
`

// デフォルトの system プロンプト（モデルへの基本指示）
const DEFAULT_SYSTEM_PROMPT = 'あなたは多肢選択式問題（複数正解可）を厳密なJSONで生成する出題エンジンです。choices/explanations は同数、選択肢数は指示に従い、explanations は各選択肢の理由（正解/不正解いずれでも）を短く返してください。余計な文字列を含めないでください。'

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
