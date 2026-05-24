import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-nex-black text-white',
        yellow: 'border-transparent bg-nex-yellow text-nex-black',
        secondary: 'border-transparent bg-nex-gray-100 text-nex-black',
        destructive: 'border-transparent bg-red-100 text-red-700',
        outline: 'text-foreground',
        success: 'border-transparent bg-green-100 text-green-700',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
