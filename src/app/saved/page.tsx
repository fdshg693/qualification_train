import { listQuestions, deleteQuestion } from '../actions'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ConfirmSubmitButton } from '@/components/ui/confirm-submit-button'
import { Select } from '@/components/ui/select'
import { db } from '@/db/client'
import { genres } from '@/db/schema'
import { Chat } from '@/components/chat'

type SavedSearchParams = { genre?: string; q?: string }

export default async function SavedPage({ searchParams }: { searchParams?: Promise<SavedSearchParams> }) {
    const sp = (await searchParams) ?? {}
    const data = await listQuestions({ genre: sp.genre, q: sp.q })
    const genreRows = await db.select().from(genres).orderBy(genres.createdAt)
    const chatContext = data.map((row: any) => ({
        question: row.question,
        choices: [row.choice0, row.choice1, row.choice2, row.choice3] as [string, string, string, string],
        answerIndex: row.answerIndex,
        explanation: row.explanation,
    }))
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">保存済みの問題</h1>
            <form className="flex gap-2" action="/saved" method="get">
                <Select name="genre" defaultValue={sp.genre || ''}>
                    <option value="">全ジャンル</option>
                    {genreRows.map((g: any) => (
                        <option key={g.id} value={g.name}>
                            {g.name}
                        </option>
                    ))}
                </Select>
                <Input name="q" placeholder="キーワード" defaultValue={sp.q || ''} />
                <Button type="submit">検索</Button>
            </form>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <div className="grid gap-3">
                    {data.map((row: any) => (
                        <Card key={row.id}>
                            <CardHeader className="flex items-center justify-between">
                                <div className="font-medium">[{row.genre}] {row.question}</div>
                                <div className="flex items-center gap-3">
                                    <div className="text-xs text-slate-500">ID: {row.id}</div>
                                    <form action={async (formData: FormData) => {
                                        'use server'
                                        const id = Number(formData.get('id'))
                                        if (!id) return
                                        await deleteQuestion(id)
                                    }}>
                                        <input type="hidden" name="id" value={row.id} />
                                        <ConfirmSubmitButton>
                                            削除
                                        </ConfirmSubmitButton>
                                    </form>
                                </div>
                            </CardHeader>
                            <CardContent className="text-sm">
                                <ol className="list-decimal pl-6 space-y-1">
                                    {[row.choice0, row.choice1, row.choice2, row.choice3].map((c, i) => (
                                        <li key={i} className={i === row.answerIndex ? 'font-semibold' : ''}>
                                            {c} {i === row.answerIndex && <span className="ml-2 text-xs text-green-700">正解</span>}
                                        </li>
                                    ))}
                                </ol>
                                <p className="text-slate-600 mt-2">解説: {row.explanation}</p>
                            </CardContent>
                        </Card>
                    ))}
                    {!data.length && <div className="text-slate-500 text-sm">保存された問題はありません</div>}
                </div>
                <div className="min-h-[600px]">
                    <Chat
                        questions={chatContext}
                        title="AIチャット"
                        fullHeight
                    />
                </div>
            </div>
        </div>
    )
}
