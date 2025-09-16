"use client"

import { useEffect, useState, useTransition } from 'react'
import type { Question } from '@/lib/schema'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Toaster, useToast } from '@/components/ui/toaster'
import { saveQuestion } from './actions'
type Genre = { id: number; name: string }
type Subgenre = { id: number; genreId: number; name: string }

export default function HomePage() {
    const [genre, setGenre] = useState<string>('')
    const [genres, setGenres] = useState<Genre[]>([])
    const [subgenres, setSubgenres] = useState<Subgenre[]>([])
    const [subgenre, setSubgenre] = useState<string>('')
    const [topic, setTopic] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<Question | null>(null)

    const { toast, message } = useToast()
    const [isSaving, startSaving] = useTransition()

    useEffect(() => {
        let canceled = false
            ; (async () => {
                try {
                    const res = await fetch('/api/genres', { cache: 'no-store' })
                    const data = (await res.json()) as Genre[]
                    if (canceled) return
                    setGenres(data)
                    const nextGenre = genre || (data[0]?.name ?? '')
                    if (nextGenre) setGenre(nextGenre)
                    // fetch subgenres for initial genre
                    const g = data.find((x) => x.name === nextGenre)
                    if (g) {
                        const res2 = await fetch(`/api/subgenres?genreId=${g.id}`, { cache: 'no-store' })
                        const subs = (await res2.json()) as Subgenre[]
                        if (canceled) return
                        setSubgenres(subs)
                        setSubgenre(subs[0]?.name ?? '')
                    } else {
                        setSubgenres([])
                        setSubgenre('')
                    }
                } catch (e) {
                    console.error(e)
                }
            })()
        return () => { canceled = true }
    }, [])

    // Fetch subgenres when genre changes
    useEffect(() => {
        let canceled = false
            ; (async () => {
                try {
                    if (!genre) {
                        setSubgenres([])
                        setSubgenre('')
                        return
                    }
                    const g = genres.find((x) => x.name === genre)
                    if (!g) return
                    const res = await fetch(`/api/subgenres?genreId=${g.id}`, { cache: 'no-store' })
                    const subs = (await res.json()) as Subgenre[]
                    if (canceled) return
                    setSubgenres(subs)
                    setSubgenre((prev) => (prev && subs.some((s) => s.name === prev) ? prev : (subs[0]?.name ?? '')))
                } catch (e) {
                    console.error(e)
                }
            })()
        return () => { canceled = true }
    }, [genre, genres])

    async function handleGenerate() {
        setLoading(true)
        setResult(null)
        try {
            const res = await fetch('/api/questions/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subgenre: subgenre || undefined, topic }),
            })
            const data = await res.json()
            setResult(data as Question)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    // ストリーミング機能は削除し、同期生成のみを使用します。

    function handleSave() {
        if (!result) return
        startSaving(async () => {
            try {
                await saveQuestion({
                    genre,
                    topic: topic || undefined,
                    question: result.question,
                    choices: [result.choices[0], result.choices[1], result.choices[2], result.choices[3]],
                    answerIndex: result.answerIndex,
                    explanation: result.explanation,
                })
                toast('保存しました')
            } catch (e) {
                console.error(e)
                toast('保存に失敗しました')
            }
        })
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">四択問題ジェネレーター</h1>
            <section className="grid gap-4">
                <label className="grid gap-2">
                    <span className="text-sm font-medium">ジャンル</span>
                    <Select value={genre} onChange={(e) => setGenre(e.target.value)}>
                        {!genres.length && <option value="">ジャンル未登録</option>}
                        {genres.map((g) => (
                            <option key={g.id} value={g.name}>
                                {g.name}
                            </option>
                        ))}
                    </Select>
                </label>
                <label className="grid gap-2">
                    <span className="text-sm font-medium">サブジャンル</span>
                    <Select value={subgenre} onChange={(e) => setSubgenre(e.target.value)}>
                        {!subgenres.length && <option value="">サブジャンル未登録</option>}
                        {subgenres.map((s) => (
                            <option key={s.id} value={s.name}>
                                {s.name}
                            </option>
                        ))}
                    </Select>
                </label>
                <label className="grid gap-2">
                    <span className="text-sm font-medium">サブトピック・出題範囲（任意）</span>
                    <Input
                        placeholder="例: OSI参照モデル, TCP/UDP"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                    />
                </label>
                <div>
                    <Button onClick={handleGenerate} disabled={loading || !genre}>
                        {loading ? '生成中…' : '生成（モックAPI呼び出し）'}
                    </Button>
                    {/* ストリーミング生成ボタンは廃止 */}
                    <Button onClick={handleSave} disabled={!result || isSaving || !genre} variant="outline" className="ml-3">
                        {isSaving ? '保存中…' : '保存'}
                    </Button>
                </div>
            </section>
            <section>
                <h2 className="text-xl font-semibold mb-2">プレビュー</h2>
                <Card>
                    <CardContent className="text-sm text-slate-800">
                        {result ? (
                            <div className="space-y-2">
                                <p className="font-medium">{result.question}</p>
                                <ol className="list-decimal pl-6 space-y-1">
                                    {result.choices.map((c, i) => (
                                        <li key={i} className={i === result.answerIndex ? 'font-semibold' : ''}>
                                            {c}
                                            {i === result.answerIndex && (
                                                <span className="ml-2 inline-block rounded bg-green-100 text-green-800 text-xs px-2 py-0.5 align-middle">正解</span>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                                <p className="text-slate-600">解説: {result.explanation}</p>
                            </div>
                        ) : (
                            <span className="text-slate-500">まだ生成していません</span>
                        )}
                    </CardContent>
                </Card>
            </section>
            <Toaster message={message} />
        </div>
    )
}
