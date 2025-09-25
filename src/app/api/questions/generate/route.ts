import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateQuestions } from '@/lib/generate-questions'
import { getPrompt } from '@/app/actions'
import { db } from '@/db/client'
import { genres, keywords } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

// Accept count and model for batch generation (default 1, default model gpt-4.1)
const BodySchema = z.object({
    genre: z.string().optional(),
    // subgenre/topic are removed from generation context
    selectedKeywords: z.array(z.string()).optional(),
    count: z.number().int().min(1).max(50).optional(),
    model: z.string().optional(),
    minCorrect: z.number().int().min(1).max(8).optional(),
    maxCorrect: z.number().int().min(1).max(8).optional(),
    concurrency: z.number().int().min(1).max(4).optional(),
    choiceCount: z.number().int().min(2).max(8).optional(),
    promptName: z.string().optional(),
})

export async function POST(req: Request) {
    // body parse (ignore errors gracefully)
    let genre: string | undefined
    let subgenre: string | undefined
    let topic: string | undefined
    let selectedKeywords: string[] | undefined
    let count = 1
    let model: string | undefined
    let minCorrect: number | undefined
    let maxCorrect: number | undefined
    let concurrency: number | undefined
    let choiceCount: number | undefined
    let promptName: string | undefined
    try {
        const json = await req.json()
        const parsed = BodySchema.safeParse(json)
        if (parsed.success) {
            genre = parsed.data.genre
            // ignore subgenre/topic even if provided
            selectedKeywords = parsed.data.selectedKeywords
            count = parsed.data.count ?? 1
            model = parsed.data.model
            minCorrect = parsed.data.minCorrect
            maxCorrect = parsed.data.maxCorrect
            concurrency = parsed.data.concurrency
            choiceCount = parsed.data.choiceCount
            promptName = parsed.data.promptName
        }
    } catch { }
    // load prompt template (default)
    const row = await getPrompt(promptName || 'default')
    const template = row.template || ''
    const systemRaw = (row as any).system || undefined
    function composePrompt(t: string) {
        const map: Record<string, string> = {
            '{genre}': genre ?? '',
            // subgenre/topic placeholders are no longer supported
            '{keywords}': (selectedKeywords && selectedKeywords.length ? selectedKeywords.join(', ') : ''),
            '{count}': String(count ?? 1),
            '{minCorrect}': String(minCorrect ?? ''),
            '{maxCorrect}': String(maxCorrect ?? ''),
            '{concurrency}': String(concurrency ?? ''),
            '{choiceCount}': String(choiceCount ?? 4),
        }
        let out = t
        for (const k of Object.keys(map)) out = out.split(k).join(map[k])
        return out
    }
    // 除外キーワードの指示を追加
    let exclusionNote = ''
    if (genre) {
        try {
            const gs = await db.select().from(genres).where(eq(genres.name, genre))
            if (gs.length) {
                const gid = gs[0].id
                const rows = await db
                    .select()
                    .from(keywords)
                    .where(and(eq(keywords.genreId, gid), eq(keywords.excluded, true)))
                const list = rows.map(r => r.name).filter(Boolean)
                if (list.length) {
                    exclusionNote = `次のキーワードやそれに密接に関連する分野・話題は出題から除外してください（重複や言い換えも不可）: ${list.join(', ')}`
                }
            }
        } catch (e) {
            console.warn('failed to load excluded keywords', e)
        }
    }
    // 選択キーワードの包含指示
    const includeNote = (selectedKeywords && selectedKeywords.length)
        ? `次のキーワードの概念を必ず一つ以上、問題文または選択肢/解説の中で扱ってください（必要に応じて組み合わせ可）: ${selectedKeywords.join(', ')}`
        : ''
    const composed = [composePrompt(template), includeNote, exclusionNote].filter(Boolean).join('\n\n')
    const system = systemRaw ? composePrompt(systemRaw) : undefined
    const questions = await generateQuestions({ genre, count, model, minCorrect, maxCorrect, prompt: composed, system, concurrency, choiceCount })
    return NextResponse.json({ questions })
}
