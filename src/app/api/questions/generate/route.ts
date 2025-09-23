import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateQuestions } from '@/lib/generate-questions'
import { getPrompt } from '@/app/actions'

// Accept count and model for batch generation (default 1, default model gpt-4.1)
const BodySchema = z.object({
    genre: z.string().optional(),
    subgenre: z.string().optional(),
    topic: z.string().optional(),
    count: z.number().int().min(1).max(50).optional(),
    model: z.string().optional(),
    minCorrect: z.number().int().min(1).max(4).optional(),
    maxCorrect: z.number().int().min(1).max(4).optional(),
    concurrency: z.number().int().min(1).max(4).optional(),
    promptName: z.string().optional(),
})

export async function POST(req: Request) {
    // body parse (ignore errors gracefully)
    let genre: string | undefined
    let subgenre: string | undefined
    let topic: string | undefined
    let count = 1
    let model: string | undefined
    let minCorrect: number | undefined
    let maxCorrect: number | undefined
    let concurrency: number | undefined
    let promptName: string | undefined
    try {
        const json = await req.json()
        const parsed = BodySchema.safeParse(json)
        if (parsed.success) {
            genre = parsed.data.genre
            subgenre = parsed.data.subgenre
            topic = parsed.data.topic
            count = parsed.data.count ?? 1
            model = parsed.data.model
            minCorrect = parsed.data.minCorrect
            maxCorrect = parsed.data.maxCorrect
            concurrency = parsed.data.concurrency
            promptName = parsed.data.promptName
        }
    } catch { }
    // load prompt template (default)
    const row = await getPrompt(promptName || 'default')
    const template = row.template || ''
    function composePrompt(t: string) {
        const map: Record<string, string> = {
            '{genre}': genre ?? '',
            '{subgenre}': subgenre ?? '',
            '{topic}': topic ?? '',
            '{count}': String(count ?? 1),
            '{minCorrect}': String(minCorrect ?? ''),
            '{maxCorrect}': String(maxCorrect ?? ''),
            '{concurrency}': String(concurrency ?? ''),
        }
        let out = t
        for (const k of Object.keys(map)) out = out.split(k).join(map[k])
        return out
    }
    const composed = composePrompt(template)
    const questions = await generateQuestions({ genre, subgenre, topic, count, model, minCorrect, maxCorrect, prompt: composed, concurrency })
    return NextResponse.json({ questions })
}
