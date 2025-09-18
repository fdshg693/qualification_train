import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateQuestions } from '@/lib/generate-questions'

// Accept count and model for batch generation (default 1, default model gpt-4.1)
const BodySchema = z.object({
    subgenre: z.string().optional(),
    topic: z.string().optional(),
    count: z.number().int().min(1).max(50).optional(),
    model: z.string().optional(),
    minCorrect: z.number().int().min(1).max(4).optional(),
    maxCorrect: z.number().int().min(1).max(4).optional(),
})

export async function POST(req: Request) {
    // body parse (ignore errors gracefully)
    let subgenre: string | undefined
    let topic: string | undefined
    let count = 1
    let model: string | undefined
    let minCorrect: number | undefined
    let maxCorrect: number | undefined
    try {
        const json = await req.json()
        const parsed = BodySchema.safeParse(json)
        if (parsed.success) {
            subgenre = parsed.data.subgenre
            topic = parsed.data.topic
            count = parsed.data.count ?? 1
            model = parsed.data.model
            minCorrect = parsed.data.minCorrect
            maxCorrect = parsed.data.maxCorrect
        }
    } catch { }
    const questions = await generateQuestions({ subgenre, topic, count, model, minCorrect, maxCorrect })
    return NextResponse.json({ questions })
}
