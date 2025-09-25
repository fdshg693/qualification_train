"use client"

import { useEffect, useState, useTransition } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
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
    // 並列度（2〜4）
    const [concurrency, setConcurrency] = useState<number>(2)
    // 選択肢数（2〜8）
    const [choiceCount, setChoiceCount] = useState<number>(4)
    // 正解数の最小/最大（1..4 の範囲で、各問の正解数はこの範囲からランダムに決定）
    const [minCorrect, setMinCorrect] = useState<number>(1)
    const [maxCorrect, setMaxCorrect] = useState<number>(1)
    const [results, setResults] = useState<Question[]>([])
    // 各問題の解答状態（複数選択対応）
    const [selectedMap, setSelectedMap] = useState<Record<number, number[]>>({})
    const [answeredMap, setAnsweredMap] = useState<Record<number, boolean>>({})
    // 下段(プレビュー+チャット)の高さ(px)。ローカルに保存して復元。
    const [mainHeight, setMainHeight] = useState<number>(640)
    // プロンプトテンプレ
    const [promptName, setPromptName] = useState<string>('default')
    const [prompts, setPrompts] = useState<{ name: string; template: string; system?: string | null }[]>([])
    const [promptPreview, setPromptPreview] = useState<string>('')
    const [systemPreview, setSystemPreview] = useState<string>('')
    // 除外中のキーワード（選択中ジャンル）
    const [excludedKeywords, setExcludedKeywords] = useState<string[]>([])

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
                        // 除外キーワードも初期取得
                        try {
                            const r = await fetch(`/api/keywords?genreId=${g.id}`, { cache: 'no-store' })
                            const rows = (await r.json()) as Array<{ id: number; genreId: number; name: string; excluded?: boolean }>
                            if (!canceled) setExcludedKeywords((rows || []).filter(k => (k as any).excluded === true).map(k => k.name))
                        } catch { setExcludedKeywords([]) }
                    } else {
                        setSubgenres([])
                        setSubgenre('')
                        setExcludedKeywords([])
                    }
                } catch (e) {
                    console.error(e)
                }
            })()
        return () => { canceled = true }
    }, [genre])

    // プロンプト一覧取得（初回のみ）
    useEffect(() => {
        let canceled = false
        ;(async () => {
            try {
                const res = await fetch('/api/prompts', { cache: 'no-store' })
                const rows = (await res.json()) as { name: string; template: string; system?: string | null }[]
                if (canceled) return
                const list = rows && rows.length ? rows : []
                setPrompts(list)
                // defaultが存在しない場合もUI上のデフォルト名は維持
            } catch (e) {
                console.warn('failed to load prompts', e)
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
                        setExcludedKeywords([])
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
                    // 除外キーワードも取得
                    try {
                        const r = await fetch(`/api/keywords?genreId=${g.id}`, { cache: 'no-store' })
                        const rows = (await r.json()) as Array<{ id: number; genreId: number; name: string; excluded?: boolean }>
                        if (!canceled) setExcludedKeywords((rows || []).filter(k => (k as any).excluded === true).map(k => k.name))
                    } catch { setExcludedKeywords([]) }
                } catch (e) {
                    console.error(e)
                }
            })()
        return () => { canceled = true }
    }, [genre, genres])

    async function handleGenerate() {
        setLoading(true)
        setResults([])
    setSelectedMap({})
        setAnsweredMap({})
        try {
            const res = await fetch('/api/questions/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // プロンプトテンプレートで単純置換するため、そのままの値を送る
                body: JSON.stringify({
                    genre: genre || undefined,
                    subgenre: subgenre || undefined,
                    topic,
                    count,
                    model,
                    minCorrect,
                    maxCorrect,
                    concurrency,
                    choiceCount,
                    promptName: promptName || undefined,
                }),
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
                    choices: q.choices,
                    answerIndexes: (q as any).answerIndexes ?? [],
                    explanations: ((q as any).explanations ?? []),
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
                        choices: q.choices,
                        answerIndexes: (q as any).answerIndexes ?? [],
                        explanations: ((q as any).explanations ?? []),
                    })
                }
                toast('全て保存しました')
            } catch (e) {
                console.error(e)
                toast('一括保存に失敗しました')
            }
        })
    }

    // 初期高さをローカルストレージから復元し、無ければ画面高の約65%に設定
    useEffect(() => {
        try {
            const saved = typeof window !== 'undefined' ? window.localStorage.getItem('qt.mainHeight') : null
            if (saved) {
                const v = Number(saved)
                if (!Number.isNaN(v) && v > 200) setMainHeight(v)
            } else if (typeof window !== 'undefined') {
                const v = Math.round(window.innerHeight * 0.65)
                setMainHeight(Math.min(Math.max(v, 320), 1000))
            }
        } catch { /* noop */ }
    }, [])

    // 変更時に保存
    useEffect(() => {
        try { if (typeof window !== 'undefined') window.localStorage.setItem('qt.mainHeight', String(mainHeight)) } catch { }
    }, [mainHeight])

    // プロンプトプレビュー（クライアント側で単純置換）
    useEffect(() => {
    const DEFAULT_USER_TEMPLATE = `ジャンル: {genre}\nサブジャンル: {subgenre}\nトピック: {topic}\n問題数: {count}\n選択肢数: {choiceCount}\n正解数の範囲: {minCorrect}〜{maxCorrect}\n並列度: {concurrency}`
    const DEFAULT_SYSTEM = 'あなたは多肢選択式問題（複数正解可）を厳密なJSONで生成する出題エンジンです。各選択肢ごとに短い理由（正解/不正解いずれでも）を explanations 配列で返してください（choices と同じ順序・同じ長さ）。余計な文字列を含めないでください。'
        const selected = prompts.find(p => p.name === promptName)
        const tmpl = selected?.template ?? DEFAULT_USER_TEMPLATE
        const map: Record<string, string> = {
            '{genre}': genre ?? '',
            '{subgenre}': subgenre ?? '',
            '{topic}': topic ?? '',
            '{count}': String(count ?? 1),
            '{minCorrect}': String(minCorrect ?? ''),
            '{maxCorrect}': String(maxCorrect ?? ''),
            '{concurrency}': String(concurrency ?? 2),
            '{choiceCount}': String(choiceCount ?? 4),
        }
        let out = tmpl
        for (const k of Object.keys(map)) out = out.split(k).join(map[k])
        // 除外指示をプレビューにも付与
        const exclusionNote = excludedKeywords.length
            ? `次のキーワードやそれに密接に関連する分野・話題は出題から除外してください（重複や言い換えも不可）: ${excludedKeywords.join(', ')}`
            : ''
        if (exclusionNote) out = [out, exclusionNote].join('\n\n')
        setPromptPreview(out)
        setSystemPreview((selected?.system ?? DEFAULT_SYSTEM) || DEFAULT_SYSTEM)
    }, [prompts, promptName, genre, subgenre, topic, count, minCorrect, maxCorrect, concurrency, choiceCount, excludedKeywords])

    // 仕切りバーのドラッグ開始
    function handleSeparatorMouseDown(e: ReactMouseEvent<HTMLDivElement>) {
        e.preventDefault()
        const startY = e.clientY
        const startH = mainHeight
        const onMouseMove = (ev: MouseEvent) => {
            const dy = ev.clientY - startY
            const next = Math.min(Math.max(startH + dy, 280), 1400)
            setMainHeight(next)
        }
        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
        }
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
    }

    return (
        <div className="flex flex-col min-h-screen">
            <h1 className="text-2xl font-bold mb-2 shrink-0">四択問題ジェネレーター</h1>
            {/* 生成フォーム（コンパクトツールバー） */}
            <section className="mb-3 shrink-0">
                <div className="flex flex-wrap items-end gap-2">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-600">ジャンル</span>
                        <Select className="h-8 px-2 py-1 text-sm" value={genre} onChange={(e) => setGenre(e.target.value)}>
                            {!genres.length && <option value="">ジャンル未登録</option>}
                            {genres.map((g) => (
                                <option key={g.id} value={g.name}>{g.name}</option>
                            ))}
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-600">サブジャンル</span>
                        <Select className="h-8 px-2 py-1 text-sm min-w-[12rem]" value={subgenre} onChange={(e) => setSubgenre(e.target.value)}>
                            <option value="">(未選択 / 全体)</option>
                            {!subgenres.length && <option value="" disabled>サブジャンル未登録</option>}
                            {subgenres.map((s) => (
                                <option key={s.id} value={s.name}>{s.name}</option>
                            ))}
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-600">テンプレ</span>
                        <Select className="h-8 px-2 py-1 text-sm min-w-[10rem]" value={promptName} onChange={(e) => setPromptName(e.target.value)}>
                            <option value="default">default</option>
                            {prompts.filter((p) => p.name !== 'default').map((p) => (
                                <option key={p.name} value={p.name}>{p.name}</option>
                            ))}
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-600">トピック</span>
                        <Input className="h-8 px-2 py-1 text-sm min-w-[14rem]" placeholder="例: OSI参照モデル" value={topic} onChange={(e) => setTopic(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1 w-28">
                        <span className="text-xs text-slate-600">生成数</span>
                        <Input className="h-8 px-2 py-1 text-sm" type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
                    </div>
                    <div className="flex flex-col gap-1 w-32">
                        <span className="text-xs text-slate-600">選択肢数</span>
                        <Select className="h-8 px-2 py-1 text-sm" value={String(choiceCount)} onChange={(e) => {
                            const v = Math.max(2, Math.min(8, Number(e.target.value) || 4))
                            setChoiceCount(v)
                            // 正解数の上限も追従
                            setMinCorrect((m) => Math.min(m, v))
                            setMaxCorrect((M) => Math.min(Math.max(M, 1), v))
                        }}>
                            {Array.from({ length: 7 }, (_, i) => i + 2).map((n) => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-600">正解数</span>
                        <div className="flex items-center gap-1">
                            <Input
                                className="h-8 px-2 py-1 text-sm w-14"
                                type="number"
                                min={1}
                                max={choiceCount}
                                value={minCorrect}
                                onChange={(e) => {
                                    const v = Math.max(1, Math.min(choiceCount, Number(e.target.value) || 1))
                                    setMinCorrect(v)
                                    if (v > maxCorrect) setMaxCorrect(v)
                                }}
                            />
                            <span className="text-xs text-slate-500">〜</span>
                            <Input
                                className="h-8 px-2 py-1 text-sm w-14"
                                type="number"
                                min={1}
                                max={choiceCount}
                                value={maxCorrect}
                                onChange={(e) => {
                                    const v = Math.max(1, Math.min(choiceCount, Number(e.target.value) || 1))
                                    setMaxCorrect(v)
                                    if (v < minCorrect) setMinCorrect(v)
                                }}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-600">モデル</span>
                        <Select className="h-8 px-2 py-1 text-sm" value={model} onChange={(e) => setModel(e.target.value)}>
                            <option value="gpt-5">gpt-5</option>
                            <option value="gpt-5-mini">gpt-5-mini</option>
                            <option value="gpt-4.1">gpt-4.1</option>
                            <option value="gpt40">gpt40</option>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-600">並列度</span>
                        <Select className="h-8 px-2 py-1 text-sm w-16" value={String(concurrency)} onChange={(e) => setConcurrency(Math.max(2, Math.min(4, Number(e.target.value) || 2)))}>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                        </Select>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <Button className="h-8 px-3 text-sm" onClick={handleGenerate} disabled={loading || !genre}>
                            {loading ? '生成中…' : '生成'}
                        </Button>
                        <Button className="h-8 px-3 text-sm" onClick={handleSaveAll} disabled={!results.length || isSaving || !genre} variant="outline">
                            {isSaving ? '保存中…' : '全て保存'}
                        </Button>
                    </div>
                </div>
                {/* ヒント行 */}
                <div className="mt-1 text-[11px] text-slate-500">/admin/prompts でテンプレを編集・追加できます</div>

                {/* 生成前プレビュー（System & User） */}
                <div className="mt-2">
                    <details>
                        <summary className="cursor-pointer text-sm font-medium select-none list-none">
                            プロンプト（プレビュー）
                            <span className="ml-2 text-xs text-slate-500">クリックで展開（system / user）</span>
                        </summary>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                            <div>
                                <div className="text-xs font-semibold text-slate-600 mb-1">System</div>
                                <pre className="whitespace-pre-wrap text-xs bg-slate-50 border rounded p-2 max-h-72 overflow-auto">{systemPreview}</pre>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-slate-600 mb-1">User</div>
                                <pre className="whitespace-pre-wrap text-xs bg-slate-50 border rounded p-2 max-h-72 overflow-auto">{promptPreview}</pre>
                            </div>
                        </div>
                    </details>
                </div>
            </section>
            {/* リサイズハンドル (フォームの直下) */}
            <div
                role="separator"
                aria-orientation="horizontal"
                title="ドラッグして高さを調整"
                className="h-2 my-2 rounded bg-slate-200 hover:bg-slate-300 cursor-row-resize select-none"
                onMouseDown={handleSeparatorMouseDown}
            />
            {/* 下段 2 カラム: 左=問題プレビュー, 右=チャット */}
            {/* メイン 2 カラム領域: 固定高(ドラッグで変更) */}
            <div className="flex flex-col lg:flex-row gap-6 overflow-hidden" style={{ height: mainHeight }}>
                {/* 問題プレビュー列 */}
                <section className="basis-1/2 flex flex-col min-h-0 overflow-hidden">
                    <h2 className="text-xl font-semibold mb-2 shrink-0">プレビュー ({results.length}問)</h2>
                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3 custom-scroll">
                        {!results.length && <Card><CardContent className="text-sm text-slate-500">まだ生成していません</CardContent></Card>}
                        {results.map((q, idx) => {
                            const answered = answeredMap[idx] || false
                            const selected = selectedMap[idx] ?? []
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
                                                disabled={answered || selected.length === 0}
                                            >
                                                解答
                                            </Button>
                                            {answered && (
                                                <span className="text-sm">
                                                    {(() => {
                                                        const ans = new Set((q as any).answerIndexes as number[])
                                                        const set = new Set(selected)
                                                        if (ans.size !== set.size) return '不正解です。'
                                                        for (const i of set) if (!ans.has(i)) return '不正解です。'
                                                        return '正解です。'
                                                    })()}
                                                </span>
                                            )}
                                        </div>
                                        <ol className="list-decimal pl-5 space-y-1.5">
                                            {q.choices.map((c, i) => {
                                                const selectedSet = new Set(selected)
                                                const isSelected = selectedSet.has(i)
                                                const correctSet = new Set((q as any).answerIndexes as number[])
                                                const isCorrect = answered && correctSet.has(i)
                                                const isWrong = answered && isSelected && !isCorrect
                                                return (
                                                    <li
                                                        key={i}
                                                        onClick={() => {
                                                            if (answered) return
                                                            setSelectedMap((m) => {
                                                                const curr = new Set(m[idx] ?? [])
                                                                if (curr.has(i)) curr.delete(i)
                                                                else curr.add(i)
                                                                return { ...m, [idx]: Array.from(curr).sort((a,b)=>a-b) }
                                                            })
                                                        }}
                                                        className={[
                                                            'cursor-pointer select-none rounded px-1 py-0.5',
                                                            isSelected && !answered ? 'bg-slate-200' : '',
                                                            isCorrect ? 'font-semibold bg-green-100' : '',
                                                            isWrong ? 'bg-red-100 line-through' : '',
                                                        ].filter(Boolean).join(' ')}
                                                    >
                                                        <div>{c}
                                                        {answered && isCorrect && (
                                                            <span className="ml-2 inline-block rounded bg-green-100 text-green-800 text-xs px-2 py-0.5 align-middle">正解</span>
                                                        )}
                                                        {answered && isWrong && (
                                                            <span className="ml-2 inline-block rounded bg-red-100 text-red-800 text-xs px-2 py-0.5 align-middle">不正解</span>
                                                        )}
                                                        </div>
                                                        {answered && (
                                                            <div className="text-xs text-slate-600 mt-1 pl-1">
                                                                {((q as any).explanations?.[i] ?? '')}
                                                            </div>
                                                        )}
                                                    </li>
                                                )
                                            })}
                                        </ol>
                                        {/* 全体の解説は廃止。各選択肢下に表示 */}
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
