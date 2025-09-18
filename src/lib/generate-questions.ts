import { QuestionSchema, type Question } from '@/lib/schema'
import { z } from 'zod'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'

// Schema for a batch of questions (array of QuestionSchema)
const QuestionsArraySchema = z.array(QuestionSchema)

export type GenerateParams = {
    subgenre?: string
    topic?: string
    count: number // desired number of questions (1..50 reasonable)
    model?: string
}

// Utility to shuffle choices and remap answerIndexes accordingly
function normalizeQuestion(q: Question): Question {
    const origChoices = Array.isArray(q.choices) ? q.choices.slice(0, 4) : []
    while (origChoices.length < 4) origChoices.push('')
    const order = [0, 1, 2, 3]
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[order[i], order[j]] = [order[j], order[i]]
    }
    const newChoices: string[] = order.map((idx) => origChoices[idx])
    // Map old index -> new index
    const pos: Record<number, number> = {}
    for (let newIdx = 0; newIdx < order.length; newIdx++) pos[order[newIdx]] = newIdx
    const origAns = Array.isArray((q as any).answerIndexes) ? (q as any).answerIndexes as number[] : []
    const newAns = origAns.map((i) => pos[i]).filter((i) => i >= 0 && i < 4)
    // ensure uniqueness and sorted for stable UI
    const uniqueSorted = Array.from(new Set(newAns)).sort((a, b) => a - b)
    return { question: q.question, choices: newChoices as [string, string, string, string], answerIndexes: uniqueSorted, explanation: q.explanation }
}

export async function generateQuestions(params: GenerateParams): Promise<Question[]> {
    const { subgenre, topic } = params
    const count = Math.max(1, Math.min(50, Math.floor(params.count)))
    const allowedModels = ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt40']
    const model = allowedModels.includes(params.model ?? '') ? (params.model as string) : 'gpt-4.1'
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
        // Mock: generate deterministic-ish set with sometimes multiple answers
        const base = [
            {
                q: 'TCPのコネクション確立で正しい手順はどれ?',
                choices: ['SYN → SYN-ACK → ACK', 'ACK → SYN-ACK → SYN', 'FIN → FIN-ACK → ACK', 'SYN → ACK → SYN-ACK'],
                answers: [0],
                exp: 'TCPは3-way handshakeでSYN→SYN-ACK→ACKの順です。'
            },
            {
                q: 'HTTPの安全なメソッドをすべて選べ。',
                choices: ['GET', 'HEAD', 'POST', 'PUT'],
                answers: [0,1],
                exp: 'GET/HEADはセーフ（副作用なし）が原則。'
            }
        ]
        const out: Question[] = []
        for (let n = 0; n < count; n++) {
            const item = base[n % base.length]
            out.push(normalizeQuestion({
                question: `(${n + 1}) ${item.q}`,
                choices: item.choices as [string, string, string, string],
                answerIndexes: item.answers,
                explanation: item.exp,
            } as Question))
        }
        return out
    }

    const openai = createOpenAI({ apiKey })
    // Ask model to return an array of JSON objects strictly matching the schema per item
    const system = `あなたは与えられたサブジャンルとサブトピックの範囲で、厳密なJSONで四択問題を${count}問だけ生成します。`;
    const user = `サブジャンル: ${subgenre ?? '未指定'} / サブトピック: ${topic ?? '未指定'}\n出力は次のzodスキーマ(オブジェクト)に一致すること: { questions: Question[] }。Question = { question: string, choices: [string,string,string,string], answerIndexes: number[], explanation: string }。answerIndexes は 0..3 の重複なし整数配列（正解が0〜4個）。余計なテキストは一切含めず、JSONのみ。 問題数: ${count}`

    // We will call model per question if array attempt fails, for robustness
    try {
            const { object } = await generateObject({
            model: openai(model),
            system,
            prompt: user,
            // Responses API requires an object-shaped JSON schema
            schema: z.object({ questions: QuestionsArraySchema }),
        }) as { object: any }

        // object could be array or single
        let arr: unknown
        if (Array.isArray(object)) arr = object
        else if (object && typeof object === 'object' && Array.isArray((object as any).questions)) arr = (object as any).questions
        else arr = [object]

        const parsed = QuestionsArraySchema.safeParse(arr)
        if (parsed.success) {
            return parsed.data.slice(0, count).map(normalizeQuestion)
        }
    } catch (e) {
        console.warn('batch generation failed, fallback to per-question', e)
    }

    // Fallback: generate one by one to ensure we still return the desired count
    const results: Question[] = []
    for (let i = 0; i < count; i++) {
        try {
            const { object } = await generateObject({
                model: openai(model),
                system: 'あなたは四択問題（複数正解可）を厳密なJSONで1問だけ生成します。',
                prompt: `${user}\n現在 ${i + 1} / ${count} 問目を生成。`,
                schema: QuestionSchema,
            })
            results.push(normalizeQuestion(object))
        } catch (e) {
            console.error('single generation failed', i, e)
        }
    }
    return results
}
