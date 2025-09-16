"use client"
import { useCallback, useState } from 'react'

export function useToast() {
    const [message, setMessage] = useState<string | null>(null)
    const toast = useCallback((msg: string) => {
        setMessage(msg)
        setTimeout(() => setMessage(null), 2500)
    }, [])
    return { toast, message }
}

export function Toaster({ message }: { message: string | null }) {
    if (!message) return null
    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded shadow">
            {message}
        </div>
    )
}
