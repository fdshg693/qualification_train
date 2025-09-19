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
    const chatContext = data.map((row: any) => {
        const choices = (row.choices as string[]) ?? []
        const answers = (row.answers as number[]) ?? []
        return ({
            question: row.question,
            choices: [choices[0], choices[1], choices[2], choices[3]] as [string, string, string, string],
            answerIndexes: answers,
            explanation: row.explanation,
        })
    })
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
            {/* 下段は固定高エリア内で左右が独立スクロール */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch h-[70vh] min-h-[560px] overflow-hidden">
                {/* 左: 問題一覧（内側スクロール） */}
                <div className="min-h-0 overflow-y-auto">
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
                                    {((row.choices as string[]) ?? []).map((c: string, i: number) => {
                                        const ans: number[] = (row.answers as number[]) ?? []
                                        const isCorrect = ans.includes(i)
                                        return (
                                            <li key={i} className={isCorrect ? 'font-semibold' : ''}>
                                                {c} {isCorrect && <span className="ml-2 text-xs text-green-700">正解</span>}
                                            </li>
                                        )
                                    })}
                                </ol>
                                <p className="text-slate-600 mt-2">解説: {row.explanation}</p>
                            </CardContent>
                        </Card>
                    ))}
                    {!data.length && <div className="text-slate-500 text-sm">保存された問題はありません</div>}
                    </div>
                </div>
                {/* 右: チャット（内側スクロール） */}
                <div className="flex flex-col min-h-0">
                    <Chat
                        questions={chatContext}
                        title="AIチャット"
                        fullHeight
                        className="h-full max-h-full"
                    />
                </div>
            </div>
        </div>
    )
}
