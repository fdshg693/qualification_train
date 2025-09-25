import { NextResponse } from 'next/server'
import { z } from 'zod'
import { desc } from 'drizzle-orm'
import { db } from '@/db/client'
import { mockExamSets } from '@/db/schema'
import { QuestionSchema } from '@/lib/schema'

const KeywordGroupSchema = z.object({
  keyword: z.string().min(1),
  questions: z.array(QuestionSchema),
})

const BodySchema = z.object({
  title: z.string().min(1).max(200),
  genre: z.string().min(1),
  keywordNames: z.array(z.string()).optional(),
  groups: z.array(KeywordGroupSchema).min(1),
})

export async function GET() {
  try {
    const rows = await db
      .select({
        id: mockExamSets.id,
        title: mockExamSets.title,
        genre: mockExamSets.genre,
        keywordNames: mockExamSets.keywordNames,
        questionCount: mockExamSets.questionCount,
        createdAt: mockExamSets.createdAt,
      })
      .from(mockExamSets)
      .orderBy(desc(mockExamSets.createdAt))
    return NextResponse.json(rows)
  } catch (err) {
    console.error('[mock-exams] list error', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = BodySchema.parse(json)
    const keywordNames = Array.from(
      new Set((parsed.keywordNames ?? parsed.groups.map((g) => g.keyword)).map((s) => s.trim()).filter(Boolean))
    )
    const questionCount = parsed.groups.reduce((acc, g) => acc + g.questions.length, 0)
    const [inserted] = await db
      .insert(mockExamSets)
      .values({
        title: parsed.title.trim(),
        genre: parsed.genre,
        keywordNames,
        questionCount,
        questionsByKeyword: parsed.groups.map((g) => ({ keyword: g.keyword, questions: g.questions })),
      })
      .returning({ id: mockExamSets.id })
    return NextResponse.json({ id: inserted.id })
  } catch (err) {
    console.error('[mock-exams] save error', err)
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'bad_request', issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
