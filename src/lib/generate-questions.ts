import { QuestionSchema, type Question } from '@/lib/schema'
import { z } from 'zod'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'

// Schema for a batch of questions (array of QuestionSchema)
const QuestionsArraySchema = z.array(QuestionSchema)

export type GenerateParams = {
    genre?: string
    subgenre?: string
    topic?: string
    count: number // desired number of questions (1..50 reasonable)
    model?: string
    minCorrect?: number // desired minimum number of correct choices per question (1..4)
    maxCorrect?: number // desired maximum number of correct choices per question (1..4)
    prompt?: string // composed prompt text from template
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
    const { genre, subgenre, topic, prompt } = params
    const count = Math.max(1, Math.min(50, Math.floor(params.count)))
    const allowedModels = ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt40']
    const model = allowedModels.includes(params.model ?? '') ? (params.model as string) : 'gpt-4.1'
    const apiKey = process.env.OPENAI_API_KEY

    // Clamp and sanitize min/max corrects (default to 1..1 to keep single-answer if unspecified)
    const minC0 = Math.max(1, Math.min(4, Math.floor(params.minCorrect ?? 1)))
    const maxC0 = Math.max(1, Math.min(4, Math.floor(params.maxCorrect ?? minC0)))
    const minC = Math.min(minC0, maxC0)
    const maxC = Math.max(minC0, maxC0)

    // Decide target K for each question upfront to ensure distribution independent of model output
    const targetKs: number[] = Array.from({ length: count }, () => {
        if (minC === maxC) return minC
        const r = Math.floor(Math.random() * (maxC - minC + 1))
        return minC + r
    })

    // Helpers to enforce exactly K answers within 0..3
    function sampleIndicesExactlyK(k: number): number[] {
        const indices = [0, 1, 2, 3]
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[indices[i], indices[j]] = [indices[j], indices[i]]
        }
        return indices.slice(0, Math.max(0, Math.min(4, k))).sort((a, b) => a - b)
    }

    function adjustAnswersToK(ans: number[] | undefined, k: number): number[] {
        const set = new Set((ans ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < 4))
        let arr = Array.from(set)
        if (arr.length > k) {
            // randomly drop extras
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                ;[arr[i], arr[j]] = [arr[j], arr[i]]
            }
            arr = arr.slice(0, k)
        } else if (arr.length < k) {
            const pool = [0, 1, 2, 3].filter((i) => !set.has(i))
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                ;[pool[i], pool[j]] = [pool[j], pool[i]]
            }
            arr = arr.concat(pool.slice(0, k - arr.length))
        }
        return Array.from(new Set(arr)).sort((a, b) => a - b)
    }

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
            const k = targetKs[n]
            out.push(normalizeQuestion({
                question: `(${n + 1}) ${item.q}`,
                choices: item.choices as [string, string, string, string],
                // Enforce exactly k correct options in mock
                answerIndexes: sampleIndicesExactlyK(k),
                explanation: item.exp,
            } as Question))
        }
        return out
    }

    const openai = createOpenAI({ apiKey })
    // Ask model to return an array of JSON objects strictly matching the schema per item
    const system = `あなたは与えられた指示に基づき、厳密なJSONで四択問題を${count}問だけ生成します。各問題は複数正解の可能性があります。`;
    const ksStr = JSON.stringify(targetKs)
    const baseContext = prompt && prompt.trim().length
        ? prompt.trim()
        : `ジャンル: ${genre ?? '未指定'}\nサブジャンル: ${subgenre ?? '未指定'}\nサブトピック: ${topic ?? '未指定'}`
    const user = `${baseContext}\n各問題 i (1..${count}) の正解数は ks[i-1] 個に「ちょうど一致」させてください。ks = ${ksStr}\n出力は次のzodスキーマ(オブジェクト)に一致すること: { questions: Question[] }。Question = { question: string, choices: [string,string,string,string], answerIndexes: number[], explanation: string }。answerIndexes は 0..3 の重複なし整数配列。余計なテキストは一切含めず、JSONのみ。 問題数: ${count}`

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
            // Enforce per-question K just in case the model drifted
            const adjusted = parsed.data.slice(0, count).map((q, i) => ({
                ...q,
                answerIndexes: adjustAnswersToK((q as any).answerIndexes as number[] | undefined, targetKs[i])
            }))
            return adjusted.map(normalizeQuestion)
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
                prompt: `${baseContext}\nこの1問の正解数は「ちょうど ${targetKs[i]} 個」にしてください。出力は Question スキーマのJSONのみ。`,
                schema: QuestionSchema,
            })
            const enforced = {
                ...object,
                answerIndexes: adjustAnswersToK((object as any).answerIndexes as number[] | undefined, targetKs[i])
            }
            results.push(normalizeQuestion(enforced as Question))
        } catch (e) {
            console.error('single generation failed', i, e)
        }
    }
    return results
}
