import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateQuestions } from '@/lib/generate-questions'

// Accept count for batch generation (default 1)
const BodySchema = z.object({ subgenre: z.string().optional(), topic: z.string().optional(), count: z.number().int().min(1).max(50).optional() })

export async function POST(req: Request) {
    // body parse (ignore errors gracefully)
    let subgenre: string | undefined
    let topic: string | undefined
    let count = 1
    try {
        const json = await req.json()
        const parsed = BodySchema.safeParse(json)
        if (parsed.success) {
            subgenre = parsed.data.subgenre
            topic = parsed.data.topic
            count = parsed.data.count ?? 1
        }
    } catch { }
    const questions = await generateQuestions({ subgenre, topic, count })
    return NextResponse.json({ questions })
}
