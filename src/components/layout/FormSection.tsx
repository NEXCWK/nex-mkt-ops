import { cn } from '@/lib/utils'

interface FormSectionProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || description) && (
        <div>
          {title && <h3 className="text-sm font-semibold text-nex-black uppercase tracking-wide">{title}</h3>}
          {description && <p className="text-sm text-nex-gray-500">{description}</p>}
        </div>
      )}
      {children}
    </div>
  )
}
