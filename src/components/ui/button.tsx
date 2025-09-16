import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'secondary' | 'outline'
    size?: 'sm' | 'md'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', size = 'md', ...props }, ref) => {
        const variants: Record<string, string> = {
            default: 'bg-blue-600 text-white hover:bg-blue-700',
            secondary: 'bg-indigo-600 text-white hover:bg-indigo-700',
            outline: 'border border-slate-300 hover:bg-slate-50',
        }
        const sizes: Record<string, string> = {
            sm: 'px-3 py-1.5 text-sm rounded',
            md: 'px-4 py-2 rounded',
        }
        return (
            <button
                ref={ref}
                className={cn('disabled:opacity-50 disabled:pointer-events-none', variants[variant], sizes[size], className)}
                {...props}
            />
        )
    }
)
Button.displayName = 'Button'
