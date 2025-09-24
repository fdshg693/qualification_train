import { getRandomQuestion } from '../actions'
import { deleteQuestion } from '../actions'
import { QuestionDisplay } from '@/components/question-display'
import { Chat } from '@/components/chat'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RefreshButton } from '@/components/refresh-button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'

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
                        <Card>
                            <CardHeader className="flex items-center justify-between">
                                <div className="font-medium">[{q.genre}] {q.question}</div>
                                <form action={async (formData: FormData) => {
                                    'use server'
                                    const id = Number(formData.get('id'))
                                    if (!id) return
                                    await deleteQuestion(id)
                                }}>
                                    <input type="hidden" name="id" value={q.id} />
                                    <ConfirmSubmitButton>削除</ConfirmSubmitButton>
                                </form>
                            </CardHeader>
                            <CardContent>
                                <QuestionDisplay
                                    question={{
                                        question: q.question,
                                        choices: q.choices,
                                        answerIndexes: q.answerIndexes ?? [],
                                        explanations: (q.explanations as string[]),
                                    }}
                                    meta={{ genre: q.genre, topic: q.topic ?? undefined }}
                                />
                            </CardContent>
                        </Card>
                    </div>
                    <div className="min-h-[480px] lg:min-h-[600px]">
                        <Chat
                            questions={[{
                                question: q.question,
                                choices: q.choices,
                                answerIndexes: q.answerIndexes ?? [],
                                explanations: (q.explanations as string[]),
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
