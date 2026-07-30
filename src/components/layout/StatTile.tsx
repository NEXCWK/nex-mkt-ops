import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatTileProps {
  icon: LucideIcon
  label: string
  value: string | number
  tone?: 'default' | 'warning' | 'success'
}

const TONE_ICON_BG: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'bg-nex-yellow/20 text-nex-black',
  warning: 'bg-red-50 text-red-500',
  success: 'bg-green-50 text-green-600',
}

/** Mini card de indicador numérico — usado em linhas de resumo (ex.: total de empresas, e-mails a enviar). */
export function StatTile({ icon: Icon, label, value, tone = 'default' }: StatTileProps) {
  return (
    <div className="flex items-center gap-3 bg-white border border-nex-gray-200 rounded-xl px-4 py-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', TONE_ICON_BG[tone])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-heading font-bold text-nex-black leading-none">{value}</p>
        <p className="text-[11px] text-nex-gray-400 mt-1 truncate">{label}</p>
      </div>
    </div>
  )
}
