import { QuestionSchema, type Question } from '@/lib/schema'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'

// (Batch schema removed; we now always generate one-by-one for accuracy)

export type GenerateParams = {
    genre?: string
    subgenre?: string
    topic?: string
    count: number // desired number of questions (1..50 reasonable)
    model?: string
    minCorrect?: number // desired minimum number of correct choices per question (1..4)
    maxCorrect?: number // desired maximum number of correct choices per question (1..4)
    prompt?: string // composed prompt text from template
    system?: string // system prompt (admin-manageable)
    concurrency?: number // parallelism for per-question generation (1..4); default 2
}

// Utility to shuffle choices and remap answerIndexes accordingly
function normalizeQuestion(q: Question): Question {
    const origChoices = Array.isArray(q.choices) ? q.choices.slice(0, 4) : []
    const origExps = Array.isArray((q as any).explanations) ? ((q as any).explanations as string[]).slice(0, 4) : []
    while (origChoices.length < 4) origChoices.push('')
    while (origExps.length < 4) origExps.push('')
    const order = [0, 1, 2, 3]
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[order[i], order[j]] = [order[j], order[i]]
    }
    const newChoices: string[] = order.map((idx) => origChoices[idx])
    const newExps: string[] = order.map((idx) => origExps[idx])
    // Map old index -> new index
    const pos: Record<number, number> = {}
    for (let newIdx = 0; newIdx < order.length; newIdx++) pos[order[newIdx]] = newIdx
    const origAns = Array.isArray((q as any).answerIndexes) ? (q as any).answerIndexes as number[] : []
    const newAns = origAns.map((i) => pos[i]).filter((i) => i >= 0 && i < 4)
    // ensure uniqueness and sorted for stable UI
    const uniqueSorted = Array.from(new Set(newAns)).sort((a, b) => a - b)
    return { question: q.question, choices: newChoices as [string, string, string, string], answerIndexes: uniqueSorted, explanations: newExps as [string, string, string, string] } as Question
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
            },
            {
                q: 'HTTPの安全なメソッドをすべて選べ。',
                choices: ['GET', 'HEAD', 'POST', 'PUT'],
                answers: [0,1],
            }
        ]
        const out: Question[] = []
        for (let n = 0; n < count; n++) {
            const item = base[n % base.length]
            const k = targetKs[n]
            const ansIdx = sampleIndicesExactlyK(k)
            // Build simple per-choice explanations for mock
            const exps = (item.choices as string[]).map((c, i) =>
                ansIdx.includes(i) ? `${c} が正解である理由: 定義や仕様に合致します。` : `${c} が不正解である理由: 定義や仕様に反します。`
            ) as [string, string, string, string]
            out.push(normalizeQuestion({
                question: `(${n + 1}) ${item.q}`,
                choices: item.choices as [string, string, string, string],
                // Enforce exactly k correct options in mock
                answerIndexes: ansIdx,
                explanations: exps,
            } as unknown as Question))
        }
        return out
    }

    // Always single-question generation path with bounded concurrency
    const openai = createOpenAI({ apiKey })
    const baseContext = prompt && prompt.trim().length
        ? prompt.trim()
        : `ジャンル: ${genre ?? '未指定'}\nサブジャンル: ${subgenre ?? '未指定'}\nサブトピック: ${topic ?? '未指定'}`

    const concurrency = Math.max(1, Math.min(4, Math.floor(params.concurrency ?? 2)))
    const results: (Question | undefined)[] = new Array(count)

    const genOne = async (i: number) => {
        const { object } = await generateObject({
            model: openai(model),
            system: (params.system && params.system.trim()) || 'あなたは四択問題（複数正解可）を厳密なJSONで1問だけ生成します。各選択肢ごとに短い理由（正解/不正解のどちらでも）を explanations 配列で返してください（choices と同じ順序・同じ長さ）。',
            prompt: `${baseContext}\nこの1問の正解数は「ちょうど ${targetKs[i]} 個」にしてください。出力は Question スキーマのJSONのみ（余計な文字列なし）。`,
            schema: QuestionSchema,
        })
        const enforced = {
            ...object,
            answerIndexes: adjustAnswersToK((object as any).answerIndexes as number[] | undefined, targetKs[i])
        }
        results[i] = normalizeQuestion(enforced as Question)
    }

    // Process in chunks to cap concurrency
    for (let start = 0; start < count; start += concurrency) {
        const end = Math.min(count, start + concurrency)
        const batch = [] as Promise<void>[]
        for (let i = start; i < end; i++) {
            batch.push(
                genOne(i).catch((e) => {
                    console.error('single generation failed', i, e)
                })
            )
        }
        await Promise.all(batch)
    }

    return results.filter((q): q is Question => Boolean(q))
}
