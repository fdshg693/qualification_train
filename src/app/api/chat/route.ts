import { NextResponse } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { z } from 'zod'

// Incoming body schema
const BodySchema = z.object({
    messages: z.array(z.object({ role: z.enum(['user', 'assistant', 'system']), content: z.string() })).default([]),
    // 現在生成済みの問題をコンテキストとして添付 (最大数を制限)
    contextQuestions: z.array(z.object({
        question: z.string(),
        choices: z.array(z.string()).length(4),
        answerIndex: z.number().int().min(0).max(3),
        explanation: z.string()
    })).optional()
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
        // Mock streaming: we will send a simple NDJSON-like text stream
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
            start(controller) {
                const mock = '（モック応答）コンテキストを元にしたサンプル回答です。'
                controller.enqueue(encoder.encode(mock))
                controller.close()
            }
        })
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache'
            }
        })
    }

    const openai = createOpenAI({ apiKey })
    const lastUser = [...body.messages].reverse().find(m => m.role === 'user')
    const prompt = lastUser?.content ?? ''

    const { textStream } = await streamText({
        model: openai('gpt-4o-mini'),
        system: systemWithContext,
        prompt
    })

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
        async start(controller) {
            try {
                for await (const chunk of textStream) {
                    controller.enqueue(encoder.encode(chunk))
                }
            } catch (e) {
                controller.error(e)
                return
            }
            controller.close()
        }
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache'
        }
    })
}
