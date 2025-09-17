import { NextResponse } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { z } from 'zod'

// Incoming body schema
const BodySchema = z.object({
    messages: z.array(z.object({ role: z.enum(['user', 'assistant', 'system']), content: z.string() })).default([]),
    contextQuestions: z.array(z.object({
        question: z.string(),
        choices: z.array(z.string()).length(4),
        answerIndex: z.number().int().min(0).max(3),
        explanation: z.string()
    })).optional(),
    model: z.string().optional() // gpt-5 | gpt-5-mini | gpt-4.1 | gpt-4o
})

export async function POST(req: Request) {
    let body: z.infer<typeof BodySchema>
    try {
        body = BodySchema.parse(await req.json())
    } catch (e) {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    // Build system prompt including selected questions for grounding
    const contextSnippet = (body.contextQuestions ?? [])
        .slice(0, 5) // limit to avoid prompt bloat
        .map((q, i) => `Q${i + 1}: ${q.question}\nChoices: ${q.choices.join(' / ')}\nAnswer: ${q.choices[q.answerIndex]}\nExplanation: ${q.explanation}`)
        .join('\n\n')

    const baseSystem = 'あなたは学習者を支援する丁寧なAIチューターです。ユーザーの質問に簡潔かつ分かりやすく日本語で答えてください。'
    const systemWithContext = contextSnippet
        ? baseSystem + `\n\n以下は現在の問題コンテキストです。参照しながら回答してください:\n` + contextSnippet
        : baseSystem

    if (!apiKey) {
        return NextResponse.json({ answer: '（モック応答）コンテキストを元にしたサンプル回答です。' })
    }

    const openai = createOpenAI({ apiKey })
    const lastUser = [...body.messages].reverse().find(m => m.role === 'user')
    const prompt = lastUser?.content ?? ''
    // モデルマッピング（存在しない場合はフォールバック）
    const requested = body.model || 'gpt-4o'
    const allowed = new Set(['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o'])
    const modelName = allowed.has(requested) ? requested : 'gpt-4o'

    try {
        const result = await generateText({
            model: openai(modelName as any),
            system: systemWithContext,
            prompt
        })
        return NextResponse.json({ answer: result.text })
    } catch (e) {
        console.error('Chat generation error', e)
        return NextResponse.json({ error: '生成に失敗しました。' }, { status: 500 })
    }
}
