import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-nex-gray-200 bg-white px-3 py-2 text-sm font-normal placeholder:text-nex-gray-300 placeholder:font-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-nex-gray-400 focus-visible:border-nex-gray-400 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
