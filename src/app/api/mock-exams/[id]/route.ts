import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { mockExamSets } from '@/db/schema'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  try {
    const rows = await db
      .select({
        id: mockExamSets.id,
        title: mockExamSets.title,
        genre: mockExamSets.genre,
        keywordNames: mockExamSets.keywordNames,
        questionCount: mockExamSets.questionCount,
        questionsByKeyword: mockExamSets.questionsByKeyword,
        createdAt: mockExamSets.createdAt,
      })
      .from(mockExamSets)
      .where(eq(mockExamSets.id, id))
      .limit(1)
    const row = rows[0]
    if (!row) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }
    return NextResponse.json({
      id: row.id,
      title: row.title,
      genre: row.genre,
      keywordNames: row.keywordNames,
      questionCount: row.questionCount,
      groups: row.questionsByKeyword,
      createdAt: row.createdAt,
    })
  } catch (err) {
    console.error('[mock-exams] fetch error', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
