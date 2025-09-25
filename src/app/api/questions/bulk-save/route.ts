import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db/client'
import { questions } from '@/db/schema'

const BodySchema = z.object({
  genre: z.string().min(1),
  questions: z.array(z.object({
    question: z.string(),
    choices: z.array(z.string()).min(2).max(8),
    answerIndexes: z.array(z.number().int().min(0)).max(8),
    explanations: z.array(z.string()),
  })).min(1)
})

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = BodySchema.parse(json)
    const genre = parsed.genre
    for (const q of parsed.questions) {
      const choices = q.choices
      const exps = q.explanations.slice(0, choices.length)
      while (exps.length < choices.length) exps.push('')
      const maxIdx = Math.max(0, choices.length - 1)
      const answers = Array.from(new Set((q.answerIndexes || []).filter((i) => i >= 0 && i <= maxIdx))).sort((a,b)=>a-b)
      await db.insert(questions).values({ genre, question: q.question, choices, answers, explanation: exps })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
}
