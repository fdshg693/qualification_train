import { listQuestions } from '../actions'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { db } from '@/db/client'
import { genres } from '@/db/schema'

export default async function SavedPage({ searchParams }: { searchParams: { genre?: string; q?: string } }) {
    const data = await listQuestions({ genre: searchParams.genre, q: searchParams.q })
    const genreRows = await db.select().from(genres).orderBy(genres.createdAt)
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">保存済みの問題</h1>
            <form className="flex gap-2" action="/saved" method="get">
                <Select name="genre" defaultValue={searchParams.genre || ''}>
                    <option value="">全ジャンル</option>
                    {genreRows.map((g: any) => (
                        <option key={g.id} value={g.name}>
                            {g.name}
                        </option>
                    ))}
                </Select>
                <Input name="q" placeholder="キーワード" defaultValue={searchParams.q || ''} />
                <Button type="submit">検索</Button>
            </form>
            <div className="grid gap-3">
                {data.map((row: any) => (
                    <Card key={row.id}>
                        <CardHeader className="flex items-center justify-between">
                            <div className="font-medium">[{row.genre}] {row.question}</div>
                            <div className="text-xs text-slate-500">ID: {row.id}</div>
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
        </div>
    )
}
