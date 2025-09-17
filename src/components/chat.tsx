"use client"

import { useEffect, useRef, useState } from 'react'
import type { Question } from '@/lib/schema'
import { Button } from '@/components/ui/button'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

type ChatProps = {
    questions: Question[]
    title?: string
    className?: string
    placeholder?: string
    /** 親要素全高レイアウトで使用する場合 true にするとカード内部を flex 縦並びにし、メッセージ領域を伸縮させる */
    fullHeight?: boolean
}

export function Chat({ questions, title = 'AIチャット', className, placeholder = '質問を入力...', fullHeight = false }: ChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | ''>('')
    // モデル選択 (既定: gpt-4o)
    const [model, setModel] = useState('gpt-4o')
    const scrollRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    }, [messages, sending])

    async function handleSend() {
        if (!input.trim()) return
        const userMsg: ChatMessage = { role: 'user', content: input.trim() }
        setMessages((m) => [...m, userMsg])
        setInput('')
        setSending(true)
        setMessages((m) => [...m, { role: 'assistant', content: '...' }])
        try {
            const contextQuestions = selectedQuestionIndex === ''
                ? []
                : [questions[selectedQuestionIndex]].filter(Boolean)
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [...messages, userMsg], contextQuestions, model })
            })
            if (!res.ok) throw new Error('Bad response')
            const data = await res.json() as { answer?: string; error?: string }
            const answer = data.answer ?? data.error ?? 'エラーが発生しました。'
            setMessages((curr) => {
                const copy = [...curr]
                for (let i = copy.length - 1; i >= 0; i--) {
                    if (copy[i].role === 'assistant' && copy[i].content === '...') {
                        copy[i] = { role: 'assistant', content: answer }
                        return copy
                    }
                }
                copy.push({ role: 'assistant', content: answer })
                return copy
            })
        } catch (e) {
            setMessages((m) => {
                const copy = [...m]
                // replace last placeholder
                for (let i = copy.length - 1; i >= 0; i--) {
                    if (copy[i].role === 'assistant' && copy[i].content === '...') {
                        copy[i] = { role: 'assistant', content: 'エラーが発生しました。' }
                        return copy
                    }
                }
                return [...copy, { role: 'assistant', content: 'エラーが発生しました。' }]
            })
        } finally {
            setSending(false)
        }
    }

    return (
        <Card className={className + (fullHeight ? ' flex flex-col' : '')}>
            <CardHeader className="text-lg font-semibold shrink-0">{title}</CardHeader>
            <CardContent className={(fullHeight ? 'flex-1 flex flex-col ' : '') + 'space-y-3'}>
                <div className="flex gap-2 items-center text-sm">
                    <label className="flex items-center gap-2">
                        <span className="whitespace-nowrap">問題コンテキスト</span>
                        <Select value={selectedQuestionIndex === '' ? '' : String(selectedQuestionIndex)} onChange={(e) => {
                            const v = e.target.value
                            setSelectedQuestionIndex(v === '' ? '' : Number(v))
                        }}>
                            <option value="">(なし)</option>
                            {questions.map((q, i) => (
                                <option key={i} value={i}>{i + 1}. {q.question.slice(0, 30)}{q.question.length > 30 ? '…' : ''}</option>
                            ))}
                        </Select>
                    </label>
                    <label className="flex items-center gap-2">
                        <span className="whitespace-nowrap">モデル</span>
                        <Select value={model} onChange={(e) => setModel(e.target.value)}>
                            <option value="gpt-5">gpt-5</option>
                            <option value="gpt-5-mini">gpt-5-mini</option>
                            <option value="gpt-4.1">gpt-4.1</option>
                            <option value="gpt-4o">gpt-4o</option>
                        </Select>
                    </label>
                </div>
                {/* メッセージエリア: fullHeight 時は親カード内でスクロール。非 fullHeight 時は固定高 */}
                <div ref={scrollRef} className={(fullHeight ? 'flex-1 min-h-0 ' : 'h-64 ') + 'overflow-y-auto border rounded p-2 bg-white space-y-2 text-sm custom-scroll'}>
                    {messages.length === 0 && (
                        <div className="text-slate-500">質問を入力して送信してください。</div>
                    )}
                    {messages.map((m, i) => (
                        <div key={i} className={m.role === 'user' ? 'text-slate-900' : 'text-blue-700'}>
                            <span className="font-medium mr-1 align-top inline-block">{m.role === 'user' ? 'あなた:' : 'AI:'}</span>
                            <div className="prose prose-sm max-w-none break-words whitespace-pre-wrap [&_*]:whitespace-pre-wrap">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        code({ inline, className, children, ...props }: any) {
                                            return inline ? (
                                                <code className="bg-slate-100 px-1 rounded text-[0.85em]" {...props}>{children}</code>
                                            ) : (
                                                <pre className="bg-slate-900 text-slate-50 p-3 rounded text-xs overflow-x-auto" {...props}>
                                                    <code>{children}</code>
                                                </pre>
                                            )
                                        },
                                        a({ children, ...props }: any) {
                                            return <a className="text-blue-600 underline" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
                                        },
                                        table({ children }: any) {
                                            return <div className="overflow-x-auto"><table className="table-auto border border-slate-300 text-xs">{children}</table></div>
                                        },
                                        th({ children }: any) {
                                            return <th className="border border-slate-300 px-2 py-1 bg-slate-100">{children}</th>
                                        },
                                        td({ children }: any) {
                                            return <td className="border border-slate-300 px-2 py-1 align-top">{children}</td>
                                        }
                                    }}
                                >
                                    {m.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ))}
                    {sending && messages[messages.length - 1]?.role === 'assistant' && (
                        <div className="text-blue-700 animate-pulse">生成中…</div>
                    )}
                </div>
                <div className="flex gap-2 items-start">
                    <textarea
                        className="flex-1 resize-none border rounded p-2 text-sm h-20 focus:outline-none focus:ring"
                        placeholder={placeholder}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    // Enter 単独での送信を無効化 (Shift+Enter で改行はブラウザ既定動作)
                    />
                    <Button disabled={sending || !input.trim()} onClick={handleSend}>送信</Button>
                </div>
            </CardContent>
        </Card>
    )
}
