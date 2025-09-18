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

// Utility to shuffle choices and randomize answerIndex similar to existing single logic
function normalizeQuestion(q: Question): Question {
    const newAnswerIndex = Math.floor(Math.random() * 4)
    const origChoices = Array.isArray(q.choices) ? q.choices.slice(0, 4) : []
    while (origChoices.length < 4) origChoices.push('')
    const modelCorrectIndex = typeof q.answerIndex === 'number' && q.answerIndex >= 0 && q.answerIndex <= 3 ? q.answerIndex : 0
    const correctAnswer = origChoices[modelCorrectIndex]
    const remaining = origChoices.filter((_, idx) => idx !== modelCorrectIndex)
    const newChoices: string[] = []
    for (let i = 0, r = 0; i < 4; i++) {
        if (i === newAnswerIndex) newChoices.push(correctAnswer)
        else newChoices.push(remaining[r++] ?? '')
    }
    return { question: q.question, choices: newChoices as [string, string, string, string], answerIndex: newAnswerIndex, explanation: q.explanation }
}

export async function generateQuestions(params: GenerateParams): Promise<Question[]> {
    const { subgenre, topic } = params
    const count = Math.max(1, Math.min(50, Math.floor(params.count)))
    const allowedModels = ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt40']
    const model = allowedModels.includes(params.model ?? '') ? (params.model as string) : 'gpt-4.1'
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
        // Mock: generate deterministic-ish set by varying index
        const baseCorrect = 'SYN → SYN-ACK → ACK'
        const distractors = ['ACK → SYN-ACK → SYN', 'FIN → FIN-ACK → ACK', 'SYN → ACK → SYN-ACK']
        const out: Question[] = []
        for (let n = 0; n < count; n++) {
            const answerIndex = Math.floor(Math.random() * 4)
            const choices: string[] = []
            for (let i = 0, d = 0; i < 4; i++) {
                if (i === answerIndex) choices.push(baseCorrect)
                else choices.push(distractors[d++])
            }
            out.push({
                question: `(${n + 1}) TCPのコネクション確立で正しい手順はどれ?`,
                choices: choices as [string, string, string, string],
                answerIndex,
                explanation: 'TCPは3-way handshakeでSYN→SYN-ACK→ACKの順に確立します。',
            })
        }
        return out
    }

    const openai = createOpenAI({ apiKey })
    // Ask model to return an array of JSON objects strictly matching the schema per item
    const system = `あなたは与えられたサブジャンルとサブトピックの範囲で、厳密なJSONで四択問題を${count}問だけ生成します。`;
    const user = `サブジャンル: ${subgenre ?? '未指定'} / サブトピック: ${topic ?? '未指定'}\n出力は次のzodスキーマ(オブジェクト)に一致すること: { questions: Question[] }。Question = { question: string, choices: [string,string,string,string], answerIndex: 0..3, explanation: string }。余計なテキストは一切含めず、JSONのみ。 問題数: ${count}`

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
                system: 'あなたは四択問題を厳密なJSONで1問だけ生成します。',
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
