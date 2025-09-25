import { QuestionSchema, type Question } from '@/lib/schema'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/default-prompts'

// (Batch schema removed; we now always generate one-by-one for accuracy)

export type GenerateParams = {
    genre?: string
    count: number // desired number of questions (1..50 reasonable)
    model?: string
    minCorrect?: number // desired minimum number of correct choices per question (1..4)
    maxCorrect?: number // desired maximum number of correct choices per question (1..4)
    prompt?: string // composed prompt text from template
    system?: string // system prompt (admin-manageable)
    concurrency?: number // parallelism for per-question generation (1..4); default 2
    choiceCount?: number // number of choices per question (2..8)
}

// Utility to shuffle choices and remap answerIndexes accordingly
function normalizeQuestion(q: Question): Question {
    const len = Math.max(2, Math.min(8, Array.isArray(q.choices) ? q.choices.length : 4))
    const origChoices = Array.isArray(q.choices) ? q.choices.slice(0, len) : []
    const origExps = Array.isArray((q as any).explanations) ? ((q as any).explanations as string[]).slice(0, len) : []
    while (origChoices.length < len) origChoices.push('')
    while (origExps.length < len) origExps.push('')
    const order = Array.from({ length: len }, (_, i) => i)
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
    const newAns = origAns.map((i) => pos[i]).filter((i) => i >= 0 && i < len)
    // ensure uniqueness and sorted for stable UI
    const uniqueSorted = Array.from(new Set(newAns)).sort((a, b) => a - b)
    return { question: q.question, choices: newChoices, answerIndexes: uniqueSorted, explanations: newExps } as Question
}

export async function generateQuestions(params: GenerateParams): Promise<Question[]> {
    const { genre, prompt } = params
    const count = Math.max(1, Math.min(50, Math.floor(params.count)))
    const allowedModels = ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt40']
    const model = allowedModels.includes(params.model ?? '') ? (params.model as string) : 'gpt-4.1'
    const apiKey = process.env.OPENAI_API_KEY
    const choiceCount = Math.max(2, Math.min(8, Math.floor(params.choiceCount ?? 4)))

    // Clamp and sanitize min/max corrects (default to 1..1 to keep single-answer if unspecified)
    const minC0 = Math.max(1, Math.min(choiceCount, Math.floor(params.minCorrect ?? 1)))
    const maxC0 = Math.max(1, Math.min(choiceCount, Math.floor(params.maxCorrect ?? minC0)))
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
        const indices = Array.from({ length: choiceCount }, (_, i) => i)
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[indices[i], indices[j]] = [indices[j], indices[i]]
        }
        return indices.slice(0, Math.max(0, Math.min(choiceCount, k))).sort((a, b) => a - b)
    }

    function adjustAnswersToK(ans: number[] | undefined, k: number): number[] {
        const set = new Set((ans ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < choiceCount))
        let arr = Array.from(set)
        if (arr.length > k) {
            // randomly drop extras
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                ;[arr[i], arr[j]] = [arr[j], arr[i]]
            }
            arr = arr.slice(0, k)
        } else if (arr.length < k) {
            const pool = Array.from({ length: choiceCount }, (_, i) => i).filter((i) => !set.has(i))
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                ;[pool[i], pool[j]] = [pool[j], pool[i]]
            }
            arr = arr.concat(pool.slice(0, k - arr.length))
        }
        return Array.from(new Set(arr)).sort((a, b) => a - b)
    }

    // Build a short context listing already generated questions to avoid duplication
    function buildDedupContext(prevQuestions: string[], maxList = 30): string {
        if (!prevQuestions.length) return ''
        const list = prevQuestions.slice(-maxList)
        const bullets = list.map((q, i) => `- (${i + 1}) ${q}`).join('\n')
        return `これまでに生成済みの問題（重複回避用、最大${maxList}件）:\n${bullets}\n上記と「重複」や「ほぼ同一内容（言い換え）」「数字や名称だけを変えた類題」にならないように、新規性のある観点・表現で出題してください。`
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
            const choices = (item.choices as string[]).slice(0, choiceCount)
            while (choices.length < choiceCount) choices.push('')
            const exps = choices.map((c, i) =>
                ansIdx.includes(i) ? `${c} が正解である理由: 定義や仕様に合致します。` : `${c} が不正解である理由: 定義や仕様に反します。`
            )
            out.push(normalizeQuestion({
                question: `(${n + 1}) ${item.q}`,
                choices: choices,
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
        : `ジャンル: ${genre ?? '未指定'}\n選択肢数: ${choiceCount}`

    const concurrency = Math.max(1, Math.min(4, Math.floor(params.concurrency ?? 2)))
    const results: (Question | undefined)[] = new Array(count)

    const genOne = async (i: number, dedupContext: string) => {
        const { object } = await generateObject({
            model: openai(model),
            // より厳密な出力規約をシステム側で明示
            system:
                (params.system && params.system.trim()) ||
                [
                    DEFAULT_SYSTEM_PROMPT,
                    // ここでは数的制約（選択肢数など）も念押し
                    `choices はちょうど ${choiceCount} 個。explanations も同じ長さ・同じ順序。`
                ].join('\n'),
            // 問題固有の制約を明示（正解数・重複回避・出力制約）
            prompt: [
                baseContext,
                dedupContext,
                `この1問の選択肢数は「${choiceCount}」。正解数は「ちょうど ${targetKs[i]} 個」。`,
                '必ず次の出力要件を満たしてください:',
                `- choices の長さ: ${choiceCount}`,
                `- explanations の長さ: ${choiceCount}（choices と同じ順序）`,
                `- answerIndexes の長さ: ${targetKs[i]}、0..$　{choiceCount - 1} の整数・重複なし・昇順`,
                '- JSON以外の文字（見出し・前置き・コードフェンス・補足文など）は一切出力しない',
                '出力は Question スキーマに適合した JSON オブジェクトのみ。',
            ].join('\n'),
            schema: QuestionSchema,
        })
        const enforced = {
            ...object,
            // clip choices/explanations to choiceCount if model over-produced
            choices: Array.isArray((object as any).choices) ? (object as any).choices.slice(0, choiceCount) : [],
            explanations: Array.isArray((object as any).explanations) ? (object as any).explanations.slice(0, choiceCount) : [],
            answerIndexes: adjustAnswersToK((object as any).answerIndexes as number[] | undefined, targetKs[i])
        }
        results[i] = normalizeQuestion(enforced as Question)
    }

    // Process in chunks to cap concurrency
    for (let start = 0; start < count; start += concurrency) {
        const end = Math.min(count, start + concurrency)
        const prevTitles = results
            .slice(0, start)
            .filter((q): q is Question => Boolean(q))
            .map((q) => q.question)
        const dedupContext = buildDedupContext(prevTitles)
        const batch = [] as Promise<void>[]
        for (let i = start; i < end; i++) {
            batch.push(
                genOne(i, dedupContext).catch((e) => {
                    console.error('single generation failed', i, e)
                })
            )
        }
        await Promise.all(batch)
    }

    return results.filter((q): q is Question => Boolean(q))
}
