import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SectionCardProps {
  /** Número da etapa exibido no selo circular (ex.: 1, 2, 3) — omitido não mostra selo. */
  step?: number
  icon: LucideIcon
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** Card de seção com selo de etapa numerado — usado para dar hierarquia visual a fluxos em várias etapas (ex.: Sistema BDR/Parcerias, CCO). */
export function SectionCard({ step, icon: Icon, title, subtitle, actions, children, className }: SectionCardProps) {
  return (
    <div className={cn('bg-white border border-nex-gray-200 rounded-xl shadow-sm', className)}>
      <div className="flex items-center justify-between gap-3 flex-wrap px-5 pt-4 pb-3 border-b border-nex-gray-100">
        <div className="flex items-center gap-2.5 min-w-0">
          {step !== undefined && (
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-nex-yellow text-nex-black text-xs font-heading font-bold flex items-center justify-center">
              {step}
            </span>
          )}
          <Icon className="w-4 h-4 text-nex-gray-400 flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-heading font-semibold text-nex-black leading-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-nex-gray-400 leading-tight mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
