'use client'

interface Props {
  palavras: Record<string, number>
}

const STOPWORDS = new Set([
  'que', 'para', 'com', 'uma', 'um', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na',
  'nos', 'nas', 'e', 'ou', 'a', 'o', 'as', 'os', 'se', 'por', 'como', 'mais', 'foi',
  'ser', 'ter', 'sua', 'seu', 'suas', 'seus', 'isso', 'esse', 'essa', 'este', 'esta',
])

export function WordCloud({ palavras }: Props) {
  const entradas = Object.entries(palavras)
    .filter(([p]) => !STOPWORDS.has(p.toLowerCase()) && p.length > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)

  if (entradas.length === 0) {
    return <p className="text-sm text-nex-gray-300 text-center py-8">Sem dados suficientes para a nuvem de palavras.</p>
  }

  const max = entradas[0][1]
  const min = entradas[entradas.length - 1][1]

  function tamanho(freq: number): number {
    if (max === min) return 16
    const t = (freq - min) / (max - min)
    return Math.round(11 + t * 22) // 11px a 33px
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 py-4">
      {entradas.map(([palavra, freq]) => (
        <span
          key={palavra}
          title={`${freq} ocorrência(s)`}
          className="font-heading text-nex-gray-700 leading-none"
          style={{ fontSize: `${tamanho(freq)}px`, opacity: 0.55 + 0.45 * (freq / max) }}
        >
          {palavra}
        </span>
      ))}
    </div>
  )
}
