interface Props {
  feito: number
  total: number
}

/** Barra de progresso do disparo em massa — reutilizada por BDR, Parcerias e CCO. */
export function BarraProgresso({ feito, total }: Props) {
  const pct = total > 0 ? Math.min(100, Math.round((feito / total) * 100)) : 0
  return (
    <div className="w-full mt-3">
      <div className="flex justify-between text-[11px] text-nex-gray-400 mb-1">
        <span>Progresso do envio</span>
        <span>{feito}/{total} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-nex-gray-100 overflow-hidden">
        <div className="h-full bg-nex-yellow rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
