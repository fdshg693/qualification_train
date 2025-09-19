'use server'

import { db } from '@/db/client'
import { questions, genres, subgenres } from '@/db/schema'
import { eq, and, like, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

type SaveParams = {
    genre: string
    topic?: string
    question: string
    choices: [string, string, string, string]
    answerIndexes: number[]
    explanation: string
}

export async function saveQuestion(params: SaveParams) {
    await db.insert(questions).values({
        genre: params.genre,
        topic: params.topic ?? null,
        question: params.question,
        choices: params.choices,
        answers: Array.from(new Set((params.answerIndexes ?? []).filter((i) => i >= 0 && i < 4))).sort((a,b)=>a-b),
        explanation: params.explanation,
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
        choices: [
            (q.choices as string[])[0] ?? '',
            (q.choices as string[])[1] ?? '',
            (q.choices as string[])[2] ?? '',
            (q.choices as string[])[3] ?? '',
        ] as [string, string, string, string],
        answerIndexes: (q.answers as number[]),
        explanation: q.explanation,
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
