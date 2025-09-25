"use client"

import { useEffect, useMemo, useState } from 'react'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { Question } from '@/lib/schema'

type GenreRow = { id: number; name: string }
type KeywordRow = { id: number; name: string; parentId: number | null }

export function MockExam({ initialGenres }: { initialGenres: GenreRow[] }) {
  const [genreId, setGenreId] = useState<number | ''>('')
  const [keywords, setKeywords] = useState<KeywordRow[]>([])
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<Set<number>>(new Set())
  const [perKeywordCount, setPerKeywordCount] = useState<number>(2)
  const allowedModels = useMemo(() => ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt40'], [])
  const [model, setModel] = useState<string>('gpt-4.1')
  const [loading, setLoading] = useState(false)
  const [questionsByKeyword, setQuestionsByKeyword] = useState<Record<string, Question[]>>({})
  const [examAnswered, setExamAnswered] = useState(false)

  // For grading summary: treat each keyword as a topic
  const flatQuestions = useMemo(() => {
    const list: { keyword: string; question: Question }[] = []
    for (const k of Object.keys(questionsByKeyword)) {
      for (const q of questionsByKeyword[k] || []) list.push({ keyword: k, question: q })
    }
    return list
  }, [questionsByKeyword])

  const canSave = useMemo(() => examAnswered && flatQuestions.length > 0, [examAnswered, flatQuestions.length])

  useEffect(() => {
    if (!genreId) {
      setKeywords([])
      setSelectedKeywordIds(new Set())
      return
    }
    let aborted = false
    ;(async () => {
      const res = await fetch(`/api/keywords?genreId=${genreId}&parentId=null`)
      if (!res.ok) return
      const data: KeywordRow[] = await res.json()
      if (!aborted) {
        setKeywords(data)
        setSelectedKeywordIds(new Set(data.map(d => d.id)))
      }
    })()
    return () => { aborted = true }
  }, [genreId])

  async function handleGenerate() {
  if (!genreId || !keywords.length) return
  const activeKeywords = keywords.filter(k => selectedKeywordIds.has(k.id))
  if (!activeKeywords.length) return
    setLoading(true)
  setQuestionsByKeyword({})
  setExamAnswered(false)
    try {
      // Fetch genre name to pass to generator
      const genreRow = initialGenres.find(g => g.id === genreId)
      const genreName = genreRow?.name
      const next: Record<string, Question[]> = {}
  for (const kw of activeKeywords) {
        const count = Math.max(1, Math.min(50, perKeywordCount))
        const body = {
          genre: genreName,
          selectedKeywords: [kw.name],
          count,
          model,
          choiceCount: 6,
          minCorrect: 3,
          maxCorrect: 3,
          concurrency: 2,
        }
        // Ask AI per keyword with dedup inside that keyword scope only (handled in lib)
        const res = await fetch('/api/questions/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        const list: Question[] = (data?.questions ?? [])
        next[kw.name] = list
        // Brief delay to avoid hitting rate limits too hard
        await new Promise(r => setTimeout(r, 50))
      }
      setQuestionsByKeyword(next)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveAll() {
    const genreName = initialGenres.find(g => g.id === genreId)?.name || ''
    const payload: { genre: string; questions: Question[] } = {
      genre: genreName,
      questions: flatQuestions.map(f => f.question),
    }
    const res = await fetch('/api/questions/bulk-save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      // no-op; could toast
    }
  }

  // Summary per keyword: correct choices selected / total choices
  // selection capture state: key = `${keyword}#${idx}`, value = array of original indexes selected

  // Track selections per question to compute summary
  const [selections, setSelections] = useState<Record<string, number[]>>({})
  const setSelectionFor = (key: string, idx: number[]) => setSelections(prev => ({ ...prev, [key]: idx }))

  const computedSummary = useMemo(() => {
    const map: Record<string, { match: number; total: number }> = {}
    for (const k of Object.keys(questionsByKeyword)) {
      map[k] = { match: 0, total: 0 }
      for (let idx = 0; idx < (questionsByKeyword[k] || []).length; idx++) {
        const q = questionsByKeyword[k][idx]
        const selected = new Set(selections[`${k}#${idx}`] || [])
        const correctSet = new Set((q as any).answerIndexes as number[])
        // total = number of correct choices; match = number of selected that are correct
        map[k].total += correctSet.size
        for (const i of selected) if (correctSet.has(i)) map[k].match += 1
      }
    }
    return map
  }, [questionsByKeyword, selections])

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); handleGenerate() }}
      >
        <div className="flex flex-col">
          <label className="text-xs text-slate-500">ジャンル</label>
          <Select value={String(genreId)} onChange={(e) => setGenreId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">選択してください</option>
            {initialGenres.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500">モデル</label>
          <Select value={model} onChange={(e) => setModel(e.target.value)}>
            {allowedModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500">各キーワードの出題数</label>
          <Input
            type="number"
            min={1}
            max={50}
            value={perKeywordCount}
            onChange={(e) => setPerKeywordCount(Number(e.target.value || 1))}
            className="w-24"
          />
        </div>
        <Button type="submit" disabled={!genreId || !keywords.length || selectedKeywordIds.size === 0 || loading}>
          {loading ? '生成中…' : '生成'}
        </Button>
      </form>

      {genreId && (
        <div className="space-y-2">
          <div className="text-sm text-slate-600">直下のキーワード数: {keywords.length}</div>
          {keywords.length > 0 && (
            <div className="border rounded p-3">
              <div className="text-sm font-medium mb-2">対象キーワードの選択</div>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-2 py-1 text-xs"
                  onClick={() => setSelectedKeywordIds(new Set(keywords.map(k => k.id)))}
                >全選択</Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-2 py-1 text-xs"
                  onClick={() => setSelectedKeywordIds(new Set())}
                >全解除</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-auto pr-2">
                {keywords.map((k) => {
                  const checked = selectedKeywordIds.has(k.id)
                  return (
                    <label key={k.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setSelectedKeywordIds(prev => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(k.id)
                            else next.delete(k.id)
                            return next
                          })
                        }}
                      />
                      <span>{k.name}</span>
                    </label>
                  )
                })}
              </div>
              <div className="text-xs text-slate-600 mt-2">選択中: {Array.from(selectedKeywordIds).length} 件</div>
            </div>
          )}
        </div>
      )}

      {/* Questions grid by keyword */}
      {Object.keys(questionsByKeyword).length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setExamAnswered(true)} disabled={examAnswered}>解答</Button>
            <Button onClick={handleSaveAll} disabled={!canSave}>保存</Button>
          </div>
          {Object.keys(questionsByKeyword).map((kw) => (
            <div key={kw} className="space-y-2">
              <h2 className="text-lg font-semibold">[{kw}]</h2>
              <div className="grid gap-3">
                {(questionsByKeyword[kw] || []).map((q, idx) => (
                  <Card key={kw + '#' + idx}>
                    <CardHeader className="py-3 flex items-center justify-between">
                      <div className="text-sm text-slate-600">{kw} - 問{idx + 1}</div>
                    </CardHeader>
                    <CardContent>
                      <QuestionWithCapture
                        keyword={kw}
                        indexKey={`${kw}#${idx}`}
                        question={q}
                        answered={examAnswered}
                        onSelection={(sel) => setSelectionFor(`${kw}#${idx}`, sel)}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {/* Summary */}
          {examAnswered && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold">まとめ</h2>
              <div className="grid gap-2">
                {Object.keys(computedSummary).map((kw) => {
                  const s = computedSummary[kw]
                  return (
                    <div key={kw} className="text-sm">
                      <span className="font-medium">{kw}</span>: {s.match} / {s.total}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Wrap QuestionDisplay to capture selections and answered event
function QuestionWithCapture({ keyword, indexKey, question, answered, onSelection }: {
  keyword: string
  indexKey: string
  question: Question
  answered: boolean
  onSelection: (selectedOriginalIndexes: number[]) => void
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // We must replicate the shuffle mapping to translate selection indexes to original indexes
  type ChoiceItem = { text: string; originalIndex: number }
  const original: ChoiceItem[] = useMemo(
    () => question.choices.map((c, i) => ({ text: c, originalIndex: i })),
    [question]
  )
  const [shuffled, setShuffled] = useState<ChoiceItem[] | null>(null)
  useEffect(() => {
    setSelected(new Set())
    const arr = [...original]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    setShuffled(arr)
  }, [question])

  useEffect(() => {
    const items = shuffled ?? original
    const origIdx = Array.from(selected).map(i => items[i]?.originalIndex).filter((n) => Number.isInteger(n)) as number[]
    onSelection(Array.from(new Set(origIdx)).sort((a,b)=>a-b))
  }, [selected, shuffled])

  const items = shuffled ?? original
  const correctSet = new Set((question as any).answerIndexes as number[])
  const isAllCorrect = useMemo(() => {
    if (!answered) return false
    const sel = new Set(Array.from(selected).map(i => items[i]?.originalIndex))
    if (sel.size !== correctSet.size) return false
    for (const i of sel) if (!correctSet.has(i)) return false
    return true
  }, [answered, selected, items, question])

  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium leading-relaxed">{question.question}</p>
      {answered && (
        <div className="text-sm">{isAllCorrect ? '正解です。' : '不正解です。'}</div>
      )}
      <ol className="list-decimal pl-6 space-y-2">
        {items.map((item, i) => {
          const isSelected = selected.has(i)
          const isCorrect = answered && correctSet.has(item.originalIndex)
          const isWrong = answered && isSelected && !isCorrect
          return (
            <li
              key={item.originalIndex}
              onClick={() => { if (answered) return; setSelected(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next }) }}
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
    </div>
  )
}
