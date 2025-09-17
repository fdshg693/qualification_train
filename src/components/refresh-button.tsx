"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type Props = {
    label?: string
}

export function RefreshButton({ label = '別の問題' }: Props) {
    const router = useRouter()
    const [pending, setPending] = useState(false)

    return (
        <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={async () => {
                try {
                    setPending(true)
                    // サーバーコンポーネントを再フェッチ
                    router.refresh()
                } finally {
                    // 軽い体感のためタイマーで解除
                    setTimeout(() => setPending(false), 300)
                }
            }}
        >
            {label}
        </Button>
    )
}
