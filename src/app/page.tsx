"use client"

import { useEffect, useState, useTransition } from 'react'
import type { Question } from '@/lib/schema'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Toaster, useToast } from '@/components/ui/toaster'
import { saveQuestion } from './actions'
import { Chat } from '@/components/chat'
type Genre = { id: number; name: string }
type Subgenre = { id: number; genreId: number; name: string }

export default function HomePage() {
    const [genre, setGenre] = useState<string>('')
    const [genres, setGenres] = useState<Genre[]>([])
    const [subgenres, setSubgenres] = useState<Subgenre[]>([])
    // サブジャンル (空文字は「未選択」= ジャンルベースで出題)
    const [subgenre, setSubgenre] = useState<string>('')
    const [topic, setTopic] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [count, setCount] = useState<number>(1)
    const [model, setModel] = useState<string>('gpt-4.1')
    const [results, setResults] = useState<Question[]>([])
    // 各問題の解答状態
    const [selectedIndices, setSelectedIndices] = useState<Record<number, number | null>>({})
    const [answeredMap, setAnsweredMap] = useState<Record<number, boolean>>({})

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
                    // 初期ロード時はサブジャンルは空で開始し、ユーザーが明示的に選択できるようにする
                    const g = data.find((x) => x.name === nextGenre)
                    if (g) {
                        const res2 = await fetch(`/api/subgenres?genreId=${g.id}`, { cache: 'no-store' })
                        const subs = (await res2.json()) as Subgenre[]
                        if (canceled) return
                        setSubgenres(subs)
                        setSubgenre('') // 空 = 全体(ジャンル)から出題
                    } else {
                        setSubgenres([])
                        setSubgenre('')
                    }
                } catch (e) {
                    console.error(e)
                }
            })()
        return () => { canceled = true }
    }, [genre])

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
                    // 既に選択していたものが存在するなら保持。無ければ空(未選択)を維持。
                    setSubgenre((prev) => (prev && subs.some((s) => s.name === prev) ? prev : ''))
                } catch (e) {
                    console.error(e)
                }
            })()
        return () => { canceled = true }
    }, [genre, genres])

    async function handleGenerate() {
        setLoading(true)
        setResults([])
        setSelectedIndices({})
        setAnsweredMap({})
        try {
            const res = await fetch('/api/questions/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // サブジャンル未選択(空)の場合はジャンルを subgenre として送ることで、ジャンル全体からの出題を生成ロジックに伝える
                body: JSON.stringify({ subgenre: (subgenre || genre) || undefined, topic, count, model }),
            })
            const data = await res.json() as { questions?: Question[] }
            setResults(data.questions ?? [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    // ストリーミング機能は削除し、同期生成のみを使用します。

    function handleSaveOne(idx: number) {
        const q = results[idx]
        if (!q) return
        startSaving(async () => {
            try {
                await saveQuestion({
                    genre,
                    topic: topic || undefined,
                    question: q.question,
                    choices: [q.choices[0], q.choices[1], q.choices[2], q.choices[3]],
                    answerIndex: q.answerIndex,
                    explanation: q.explanation,
                })
                toast(`問題${idx + 1}を保存しました`)
            } catch (e) {
                console.error(e)
                toast(`問題${idx + 1}の保存に失敗しました`)
            }
        })
    }

    function handleSaveAll() {
        if (!results.length) return
        startSaving(async () => {
            try {
                for (let i = 0; i < results.length; i++) {
                    const q = results[i]
                    await saveQuestion({
                        genre,
                        topic: topic || undefined,
                        question: q.question,
                        choices: [q.choices[0], q.choices[1], q.choices[2], q.choices[3]],
                        answerIndex: q.answerIndex,
                        explanation: q.explanation,
                    })
                }
                toast('全て保存しました')
            } catch (e) {
                console.error(e)
                toast('一括保存に失敗しました')
            }
        })
    }

    return (
        <div className="flex flex-col h-screen max-h-screen">
            <h1 className="text-2xl font-bold mb-4 shrink-0">四択問題ジェネレーター</h1>
            {/* 生成フォーム */}
            <section className="grid gap-4 mb-4 shrink-0">
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
                        {/* 空(=ジャンル全体) の明示的な選択肢 */}
                        <option value="">(未選択 / ジャンル全体)</option>
                        {!subgenres.length && <option value="" disabled>サブジャンル未登録</option>}
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
                <label className="grid gap-2">
                    <span className="text-sm font-medium">生成数</span>
                    <Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
                </label>
                <label className="grid gap-2">
                    <span className="text-sm font-medium">モデル</span>
                    <Select value={model} onChange={(e) => setModel(e.target.value)}>
                        <option value="gpt-5">gpt-5</option>
                        <option value="gpt-5-mini">gpt-5-mini</option>
                        <option value="gpt-4.1">gpt-4.1</option>
                        <option value="gpt40">gpt40</option>
                    </Select>
                </label>
                <div className="flex items-center gap-3 mt-2">
                    <Button onClick={handleGenerate} disabled={loading || !genre}>
                        {loading ? '生成中…' : '生成'}
                    </Button>
                    <Button onClick={handleSaveAll} disabled={!results.length || isSaving || !genre} variant="outline">
                        {isSaving ? '保存中…' : '全て保存'}
                    </Button>
                </div>
            </section>
            {/* 下段 2 カラム: 左=問題プレビュー, 右=チャット */}
            {/* メイン 2 カラム領域 (ヘッダ+フォームを除いた残りの高さ) */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">
                {/* 問題プレビュー列 */}
                <section className="basis-1/2 flex flex-col min-h-0 overflow-hidden">
                    <h2 className="text-xl font-semibold mb-2 shrink-0">プレビュー ({results.length}問)</h2>
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4 custom-scroll">
                        {!results.length && <Card><CardContent className="text-sm text-slate-500">まだ生成していません</CardContent></Card>}
                        {results.map((q, idx) => {
                            const answered = answeredMap[idx] || false
                            const selected = selectedIndices[idx] ?? null
                            return (
                                <Card key={idx}>
                                    <CardHeader className="flex flex-row items-start justify-between">
                                        <div className="font-medium">{idx + 1}. {q.question}</div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => handleSaveOne(idx)} disabled={isSaving || !genre}>保存</Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="text-sm text-slate-800 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setAnsweredMap((m) => ({ ...m, [idx]: true }))}
                                                disabled={answered || selected === null}
                                            >
                                                解答
                                            </Button>
                                            {answered && selected !== null && (
                                                <span className="text-sm">
                                                    {selected === q.answerIndex ? '正解です。' : '不正解です。'}
                                                </span>
                                            )}
                                        </div>
                                        <ol className="list-decimal pl-6 space-y-1">
                                            {q.choices.map((c, i) => {
                                                const isSelected = selected === i
                                                const isCorrect = answered && i === q.answerIndex
                                                const isWrong = answered && isSelected && !isCorrect
                                                return (
                                                    <li
                                                        key={i}
                                                        onClick={() => {
                                                            if (answered) return
                                                            setSelectedIndices((s) => ({ ...s, [idx]: i }))
                                                        }}
                                                        className={[
                                                            'cursor-pointer select-none rounded px-1 py-0.5',
                                                            isSelected && !answered ? 'bg-slate-200' : '',
                                                            isCorrect ? 'font-semibold bg-green-100' : '',
                                                            isWrong ? 'bg-red-100 line-through' : '',
                                                        ].filter(Boolean).join(' ')}
                                                    >
                                                        {c}
                                                        {answered && isCorrect && (
                                                            <span className="ml-2 inline-block rounded bg-green-100 text-green-800 text-xs px-2 py-0.5 align-middle">正解</span>
                                                        )}
                                                        {answered && isWrong && (
                                                            <span className="ml-2 inline-block rounded bg-red-100 text-red-800 text-xs px-2 py-0.5 align-middle">不正解</span>
                                                        )}
                                                    </li>
                                                )
                                            })}
                                        </ol>
                                        {answered && (
                                            <p className="text-slate-600">解説: {q.explanation}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </section>
                {/* チャット列 */}
                <section className="basis-1/2 flex flex-col min-h-0 overflow-hidden">
                    <h2 className="text-xl font-semibold mb-2 shrink-0">学習サポートチャット</h2>
                    {/* チャットは独立スクロール。高さは残余領域内で max-h を制限しすぎないよう flex-1 */}
                    <div className="flex-1 min-h-0">
                        <Chat questions={results} fullHeight className="h-full max-h-full" />
                    </div>
                </section>
            </div>
            <Toaster message={message} />
        </div>
    )
}
