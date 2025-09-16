import { NextResponse } from 'next/server'
import { z } from 'zod'
import { QuestionSchema } from '@/lib/schema'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'

const BodySchema = z.object({ subgenre: z.string().optional(), topic: z.string().optional() })

export async function POST(req: Request) {
    // body parse (ignore errors gracefully)
    let subgenre: string | undefined
    let topic: string | undefined
    try {
        const json = await req.json()
        const parsed = BodySchema.safeParse(json)
        if (parsed.success) {
            subgenre = parsed.data.subgenre
            topic = parsed.data.topic
        }
    } catch { }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
        // Fallback to mock when no API key
        const correct = 'SYN → SYN-ACK → ACK'
        const distractors = ['ACK → SYN-ACK → SYN', 'FIN → FIN-ACK → ACK', 'SYN → ACK → SYN-ACK']
        // choose random index for answer placement
        const answerIndex = Math.floor(Math.random() * 4)
        const choices: string[] = []
        // fill choices placing correct answer at answerIndex
        for (let i = 0, d = 0; i < 4; i++) {
            if (i === answerIndex) choices.push(correct)
            else choices.push(distractors[d++])
        }

        const mock = {
            question: 'TCPのコネクション確立で正しい手順はどれ?',
            choices,
            answerIndex,
            explanation: 'TCPは3-way handshakeでSYN→SYN-ACK→ACKの順に確立します。',
        }
        return NextResponse.json(mock)
    }

    const openai = createOpenAI({ apiKey })
    const system = `あなたは与えられたサブジャンルとサブトピックの範囲で、厳密なJSONで四択問題を1問だけ生成します。`;
    const user = `サブジャンル: ${subgenre ?? '未指定'} / サブトピック: ${topic ?? '未指定'}
出力は次のzodスキーマに一致すること:
{ question: string, choices: [string,string,string,string], answerIndex: 0..3, explanation: string }`

    const { object } = await generateObject({
        model: openai('gpt-4.1'),
        system,
        prompt: user,
        schema: QuestionSchema,
    })

    // Server chooses a random answerIndex and reorders choices so the correct
    // answer from the model ends up at that index. This keeps DB unchanged.
    try {
        const newAnswerIndex = Math.floor(Math.random() * 4)
        // ensure choices is an array of 4 strings
        const origChoices: string[] = Array.isArray(object.choices) ? object.choices.slice(0, 4) : []
        // clamp to 4 entries, pad if necessary
        while (origChoices.length < 4) origChoices.push('')

        // model may include answerIndex; treat that as the index of the correct answer
        const modelCorrectIndex = typeof object.answerIndex === 'number' && object.answerIndex >= 0 && object.answerIndex <= 3 ? object.answerIndex : 0
        const correctAnswer = origChoices[modelCorrectIndex]

        // build new choices placing correctAnswer at newAnswerIndex and filling others with remaining
        const remaining = origChoices.filter((_, idx) => idx !== modelCorrectIndex)
        const newChoices: string[] = []
        for (let i = 0, r = 0; i < 4; i++) {
            if (i === newAnswerIndex) newChoices.push(correctAnswer)
            else newChoices.push(remaining[r++] ?? '')
        }

        const out = {
            question: object.question,
            choices: newChoices,
            answerIndex: newAnswerIndex,
            explanation: object.explanation,
        }

        return NextResponse.json(out)
    } catch (e) {
        // on any error, return original object
        return NextResponse.json(object)
    }
}
