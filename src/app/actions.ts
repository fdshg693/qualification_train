'use server'

import { db } from '@/db/client'
import { questions } from '@/db/schema'
import { eq, and, like } from 'drizzle-orm'

type SaveParams = {
    genre: string
    topic?: string
    question: string
    choices: [string, string, string, string]
    answerIndex: number
    explanation: string
}

export async function saveQuestion(params: SaveParams) {
    await db.insert(questions).values({
        genre: params.genre,
        topic: params.topic ?? null,
        question: params.question,
        choice0: params.choices[0],
        choice1: params.choices[1],
        choice2: params.choices[2],
        choice3: params.choices[3],
        answerIndex: params.answerIndex,
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
