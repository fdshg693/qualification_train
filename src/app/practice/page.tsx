import { getRandomQuestion } from '../actions'
import { QuestionDisplay } from '@/components/question-display'
import { Chat } from '@/components/chat'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RefreshButton } from '@/components/refresh-button'

export const dynamic = 'force-dynamic'

export default async function PracticePage() {
    const q = await getRandomQuestion()

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">ランダム練習</h1>
            <div className="flex gap-3">
                <RefreshButton label="別の問題" />
                <Link href="/saved" prefetch={false} className="text-sm text-slate-500 self-center hover:underline">
                    保存済み一覧へ戻る
                </Link>
            </div>
            {!q && (
                <p className="text-sm text-slate-500">まだ問題が保存されていません。</p>
            )}
            {q && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                    <div className="space-y-4">
                        <QuestionDisplay
                            question={{
                                question: q.question,
                                choices: q.choices,
                                answerIndexes: q.answerIndexes ?? [],
                                explanation: q.explanation,
                            }}
                            meta={{ genre: q.genre, topic: q.topic ?? undefined }}
                        />
                    </div>
                    <div className="min-h-[480px] lg:min-h-[600px]">
                        <Chat
                            questions={[{
                                question: q.question,
                                choices: q.choices,
                                answerIndexes: q.answerIndexes ?? [],
                                explanation: q.explanation,
                            }]}
                            title="AIチャット"
                            fullHeight
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
