"use client"

import { useEffect, useRef, useState } from 'react'
import type { Question } from '@/lib/schema'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

type ChatProps = {
    questions: Question[]
    title?: string
    className?: string
    placeholder?: string
}

export function Chat({ questions, title = 'AIチャット', className, placeholder = '質問を入力...' }: ChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | ''>('')
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
        let assistantContent = ''
        setMessages((m) => [...m, { role: 'assistant', content: '...' }])
        try {
            const contextQuestions = selectedQuestionIndex === ''
                ? []
                : [questions[selectedQuestionIndex]].filter(Boolean)
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [...messages, userMsg], contextQuestions })
            })
            if (!res.body) throw new Error('No body')
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            while (true) {
                const { value, done } = await reader.read()
                if (done) break
                assistantContent += decoder.decode(value, { stream: true })
                setMessages((curr) => {
                    const copy = [...curr]
                    // replace last assistant placeholder
                    for (let i = copy.length - 1; i >= 0; i--) {
                        if (copy[i].role === 'assistant' && copy[i].content === '...') {
                            copy[i] = { role: 'assistant', content: assistantContent }
                            return copy
                        }
                    }
                    // or append if not found
                    copy.push({ role: 'assistant', content: assistantContent })
                    return copy
                })
            }
        } catch (e) {
            setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: 'エラーが発生しました。' }])
        } finally {
            setSending(false)
        }
    }

    return (
        <Card className={className}>
            <CardHeader className="text-lg font-semibold">{title}</CardHeader>
            <CardContent className="space-y-3">
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
                </div>
                <div ref={scrollRef} className="h-64 overflow-y-auto border rounded p-2 bg-white space-y-2 text-sm">
                    {messages.length === 0 && (
                        <div className="text-slate-500">質問を入力して送信してください。</div>
                    )}
                    {messages.map((m, i) => (
                        <div key={i} className={m.role === 'user' ? 'text-slate-900' : 'text-blue-700'}>
                            <span className="font-medium mr-1">{m.role === 'user' ? 'あなた:' : 'AI:'}</span>
                            <span className="whitespace-pre-wrap break-words">{m.content}</span>
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
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                if (!sending) handleSend()
                            }
                        }}
                    />
                    <Button disabled={sending || !input.trim()} onClick={handleSend}>送信</Button>
                </div>
            </CardContent>
        </Card>
    )
}
