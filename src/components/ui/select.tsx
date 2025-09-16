import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { }

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => {
    return (
        <select
            ref={ref}
            className={cn('border rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500', className)}
            {...props}
        >
            {children}
        </select>
    )
})
Select.displayName = 'Select'
