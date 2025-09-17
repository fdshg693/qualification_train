import { getRandomQuestion } from '../actions'
import { QuestionDisplay } from '@/components/question-display'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function PracticePage() {
    const q = await getRandomQuestion()

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">ランダム練習</h1>
            <div className="flex gap-3">
                <Link href="/practice" prefetch={false}>
                    <Button variant="outline">別の問題</Button>
                </Link>
                <Link href="/saved" prefetch={false} className="text-sm text-slate-500 self-center hover:underline">
                    保存済み一覧へ戻る
                </Link>
            </div>
            {!q && (
                <p className="text-sm text-slate-500">まだ問題が保存されていません。</p>
            )}
            {q && (
                <QuestionDisplay
                    question={{
                        question: q.question,
                        choices: q.choices,
                        answerIndex: q.answerIndex,
                        explanation: q.explanation,
                    }}
                    meta={{ genre: q.genre, topic: q.topic ?? undefined }}
                />
            )}
        </div>
    )
}
