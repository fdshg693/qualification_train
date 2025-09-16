import { NextResponse } from 'next/server'
import { z } from 'zod'
import { QuestionSchema } from '@/lib/schema'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'

const BodySchema = z.object({ genre: z.string().optional(), topic: z.string().optional() })

export async function POST(req: Request) {
    // body parse (ignore errors gracefully)
    let genre: string | undefined
    let topic: string | undefined
    try {
        const json = await req.json()
        const parsed = BodySchema.safeParse(json)
        if (parsed.success) {
            genre = parsed.data.genre
            topic = parsed.data.topic
        }
    } catch { }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        // Fallback to mock when no API key
        const mock = {
            question: 'TCPのコネクション確立で正しい手順はどれ?',
            choices: ['SYN → SYN-ACK → ACK', 'ACK → SYN-ACK → SYN', 'FIN → FIN-ACK → ACK', 'SYN → ACK → SYN-ACK'],
            answerIndex: 0,
            explanation: 'TCPは3-way handshakeでSYN→SYN-ACK→ACKの順に確立します。',
        }
        return NextResponse.json(mock)
    }

    const openai = createOpenAI({ apiKey })
    const system = `あなたは与えられたジャンルとサブトピックの範囲で、厳密なJSONで四択問題を1問だけ生成します。`;
    const user = `ジャンル: ${genre ?? '未指定'} / サブトピック: ${topic ?? '未指定'}
出力は次のzodスキーマに一致すること:
{ question: string, choices: [string,string,string,string], answerIndex: 0..3, explanation: string }`

    const { object } = await generateObject({
        model: openai('gpt-4.1'),
        system,
        prompt: user,
        schema: QuestionSchema,
    })

    return NextResponse.json(object)
}
