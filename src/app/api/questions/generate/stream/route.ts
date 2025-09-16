import { z } from 'zod'
import { QuestionSchema } from '@/lib/schema'
import { createOpenAI } from '@ai-sdk/openai'
import { streamObject } from 'ai'

const encoder = new TextEncoder()

export async function POST(req: Request) {
    // try to parse input (optional)
    let body: { genre?: string; topic?: string } = {}
    try {
        body = (await req.json()) ?? {}
    } catch { }
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        // fallback to the previous mock stream when no API key
        const mock = {
            question: 'TCPのコネクション確立で正しい手順はどれ?',
            choices: ['SYN → SYN-ACK → ACK', 'ACK → SYN-ACK → SYN', 'FIN → FIN-ACK → ACK', 'SYN → ACK → SYN-ACK'],
            answerIndex: 0,
            explanation: 'TCPは3-way handshakeでSYN→SYN-ACK→ACKの順に確立します。',
        }
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'start' }) + '\n'))
                controller.enqueue(
                    encoder.encode(JSON.stringify({ type: 'partial', key: 'question', value: mock.question }) + '\n')
                )
                mock.choices.forEach((c, i) => {
                    controller.enqueue(
                        encoder.encode(JSON.stringify({ type: 'partial', key: 'choice', index: i, value: c }) + '\n')
                    )
                })
                controller.enqueue(
                    encoder.encode(JSON.stringify({ type: 'partial', key: 'answerIndex', value: mock.answerIndex }) + '\n')
                )
                controller.enqueue(
                    encoder.encode(JSON.stringify({ type: 'partial', key: 'explanation', value: mock.explanation }) + '\n')
                )
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'final' }) + '\n'))
                controller.close()
            },
        })
        return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' } })
    }

    const openai = createOpenAI({ apiKey })
    const system = `あなたは与えられたジャンルとサブトピックの範囲で、厳密なJSONで四択問題を1問だけ生成します。`;

    const result = await streamObject({
        model: openai('gpt-4o-mini'),
        system,
        prompt: `ジャンル: ${body.genre ?? '未指定'} / サブトピック: ${body.topic ?? '未指定'}\n` +
            `出力スキーマ: { question: string, choices: [string,string,string,string], answerIndex: 0..3, explanation: string }`,
        schema: QuestionSchema,
    })

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            controller.enqueue(encoder.encode(JSON.stringify({ type: 'start' }) + '\n'))
            try {
                for await (const partial of result.partialObjectStream) {
                    if (partial.question !== undefined) {
                        controller.enqueue(
                            encoder.encode(
                                JSON.stringify({ type: 'partial', key: 'question', value: partial.question }) + '\n'
                            )
                        )
                    }
                    if (partial.choices !== undefined) {
                        // emit any updated indices
                        for (let i = 0; i < partial.choices.length; i++) {
                            const v = partial.choices[i]
                            if (typeof v === 'string' && v.length > 0) {
                                controller.enqueue(
                                    encoder.encode(
                                        JSON.stringify({ type: 'partial', key: 'choice', index: i, value: v }) + '\n'
                                    )
                                )
                            }
                        }
                    }
                    if (partial.answerIndex !== undefined) {
                        controller.enqueue(
                            encoder.encode(
                                JSON.stringify({ type: 'partial', key: 'answerIndex', value: partial.answerIndex }) + '\n'
                            )
                        )
                    }
                    if (partial.explanation !== undefined) {
                        controller.enqueue(
                            encoder.encode(
                                JSON.stringify({ type: 'partial', key: 'explanation', value: partial.explanation }) + '\n'
                            )
                        )
                    }
                }
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'final' }) + '\n'))
                controller.close()
            } catch (e) {
                controller.error(e as any)
            }
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache',
        },
    })
}
