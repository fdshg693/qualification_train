'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    confirmMessage?: string
}

// A submit button that asks for confirmation on the client before submitting the form
export function ConfirmSubmitButton({
    className,
    confirmMessage = '削除してもよろしいですか？',
    onClick,
    children,
    ...props
}: Props) {
    return (
        <button
            type="submit"
            className={cn('text-sm text-red-600 hover:underline', className)}
            onClick={(e) => {
                // Run user-provided onClick first if any
                onClick?.(e)
                if (e.defaultPrevented) return
                const ok = window.confirm(confirmMessage)
                if (!ok) {
                    e.preventDefault()
                }
            }}
            {...props}
        >
            {children}
        </button>
    )
}
