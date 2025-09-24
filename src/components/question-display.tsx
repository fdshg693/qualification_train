"use client"

import { useEffect, useMemo, useState } from 'react'
import type { Question } from '@/lib/schema'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export type QuestionDisplayProps = {
    question: Question
    // optional: show genre/topic meta
    meta?: { genre?: string; topic?: string | null }
}

export function QuestionDisplay({ question, meta }: QuestionDisplayProps) {
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [answered, setAnswered] = useState(false)

    // SSR と CSR の不一致を避けるため、初回はそのまま表示し、マウント後にシャッフル
    type ChoiceItem = { text: string; originalIndex: number }
    const original: ChoiceItem[] = useMemo(
        () => question.choices.map((c, i) => ({ text: c, originalIndex: i })),
        [question]
    )
    const [shuffled, setShuffled] = useState<ChoiceItem[] | null>(null)

    useEffect(() => {
        // 新しい問題表示時は状態リセット
    setSelected(new Set())
        setAnswered(false)

        // クライアント側でのみシャッフル（Fisher-Yates）
        const arr = [...original]
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
                ;[arr[i], arr[j]] = [arr[j], arr[i]]
        }
        setShuffled(arr)
    }, [question, original])

    const items = shuffled ?? original // ハイドレーション時は original と一致させる

    const isAllCorrect = useMemo(() => {
        const ans = new Set((question as any).answerIndexes as number[])
        if (!answered) return false
        if (selected.size !== ans.size) return false
        for (const idx of selected) {
            const original = items[idx]?.originalIndex
            if (!ans.has(original)) return false
        }
        return true
    }, [answered, selected, items, question])

    return (
        <Card>
            <CardContent className="pt-4 text-sm text-slate-800 space-y-3">
                {meta && (
                    <div className="text-xs text-slate-500 flex gap-2">
                        {meta.genre && <span>ジャンル: {meta.genre}</span>}
                        {meta.topic && <span>トピック: {meta.topic}</span>}
                    </div>
                )}
                <p className="font-medium leading-relaxed">{question.question}</p>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAnswered(true)}
                        disabled={answered || selected.size === 0}
                    >
                        解答
                    </Button>
                    {answered && (
                        <span className="text-sm">
                            {isAllCorrect ? '正解です。' : '不正解です。'}
                        </span>
                    )}
                </div>
                <ol className="list-decimal pl-6 space-y-2">
                    {items.map((item, i) => {
                        const isSelected = selected.has(i)
                        const correctSet = new Set((question as any).answerIndexes as number[])
                        const isCorrect = answered && correctSet.has(item.originalIndex)
                        const isWrong = answered && isSelected && !isCorrect
                        return (
                            <li
                                key={item.originalIndex}
                                onClick={() => {
                                    if (answered) return
                                    setSelected((prev) => {
                                        const next = new Set(prev)
                                        if (next.has(i)) next.delete(i)
                                        else next.add(i)
                                        return next
                                    })
                                }}
                                className={[
                                    'cursor-pointer select-none rounded px-1 py-0.5',
                                    isSelected && !answered ? 'bg-slate-200' : '',
                                    isCorrect ? 'font-semibold bg-green-100' : '',
                                    isWrong ? 'bg-red-100 line-through' : '',
                                ].filter(Boolean).join(' ')}
                            >
                                <div>{item.text}
                                {answered && isCorrect && (
                                    <span className="ml-2 inline-block rounded bg-green-100 text-green-800 text-xs px-2 py-0.5 align-middle">正解</span>
                                )}
                                {answered && isWrong && (
                                    <span className="ml-2 inline-block rounded bg-red-100 text-red-800 text-xs px-2 py-0.5 align-middle">不正解</span>
                                )}
                                </div>
                                {answered && (
                                    <div className="text-xs text-slate-600 mt-1 pl-1">
                                        {((question as any).explanations?.[item.originalIndex] ?? '')}
                                    </div>
                                )}
                            </li>
                        )
                    })}
                </ol>
                {/* 全体の解説は廃止。各選択肢の下に表示。 */}
            </CardContent>
        </Card>
    )
}
