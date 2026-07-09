'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { Loader2, RefreshCw, Coins } from 'lucide-react'

interface ResumoFuncionalidade {
  funcionalidade: string
  chamadas: number
  tokensInput: number
  tokensOutput: number
  custoUsd: number
}

const LABELS: Record<string, string> = {
  avaliacao_atendimentos: 'Avaliação de Atendimentos',
  avaliacao_telefonemas: 'Avaliador de Telefonemas',
  criador_criativos: 'Criador de Criativos',
  criador_lp: 'Criador de LP',
  base_conhecimento_chat: 'Base de Conhecimento (chat)',
  base_conhecimento_resumo: 'Base de Conhecimento (resumo)',
  prospeccao_bdr: 'Sistema BDR',
  prospeccao_parcerias: 'Sistema Parcerias',
  templates_parametrizar: 'Templates (parametrizar)',
  templates_editar: 'Templates (editar)',
  waba_template: 'Gerador de Templates WABA',
  gerador_scripts: 'Gerador de Scripts',
  assistente: 'Assistente',
}

function nomeAmigavel(slug: string): string {
  return LABELS[slug] ?? slug
}

function formatUsd(v: number): string {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function formatNumero(v: number): string {
  return v.toLocaleString('pt-BR')
}

export default function UsoTokensPage() {
  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState<ResumoFuncionalidade[]>([])
  const [custoTotal, setCustoTotal] = useState(0)
  const [chamadasTotal, setChamadasTotal] = useState(0)
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  async function carregar() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (de) params.set('de', de)
      if (ate) params.set('ate', ate)
      const res = await fetch(`/api/uso-tokens?${params.toString()}`)
      const json = await res.json()
      setResumo(json.resumo ?? [])
      setCustoTotal(json.custoTotalUsd ?? 0)
      setChamadasTotal(json.chamadasTotal ?? 0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const maiorCusto = Math.max(1e-9, ...resumo.map(r => r.custoUsd))

  return (
    <div>
      <PageHeader
        title="Uso de Tokens (Claude)"
        description="Consumo estimado de tokens e custo por funcionalidade do sistema."
        actions={
          <button
            onClick={carregar}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-nex-gray-400 hover:text-nex-black transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Atualizar
          </button>
        }
      />

      <div className="flex flex-wrap items-end gap-3 mb-5 bg-white border border-nex-gray-200 rounded-xl p-4">
        <div>
          <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">De</label>
          <input type="date" value={de} onChange={e => setDe(e.target.value)}
            className="rounded-lg border border-nex-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
        </div>
        <div>
          <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Até</label>
          <input type="date" value={ate} onChange={e => setAte(e.target.value)}
            className="rounded-lg border border-nex-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
        </div>
        <button
          onClick={carregar}
          className="px-4 py-2 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 transition-colors"
        >
          Filtrar
        </button>
        {(de || ate) && (
          <button
            onClick={() => { setDe(''); setAte(''); carregar() }}
            className="text-xs text-nex-gray-400 hover:text-nex-black transition-colors"
          >
            Limpar filtro
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-nex-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-6 bg-white border border-nex-gray-200 rounded-xl p-5">
            <div>
              <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Custo total estimado</p>
              <p className="text-3xl font-bold text-nex-black flex items-center gap-2">
                <Coins className="w-6 h-6 text-nex-yellow" /> {formatUsd(custoTotal)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Chamadas registradas</p>
              <p className="text-3xl font-bold text-nex-black">{formatNumero(chamadasTotal)}</p>
            </div>
          </div>

          {resumo.length === 0 ? (
            <div className="py-10 text-center text-sm text-nex-gray-300">
              Nenhum uso registrado ainda no período selecionado.
            </div>
          ) : (
            <div className="bg-white border border-nex-gray-200 rounded-xl p-5 space-y-4">
              {resumo.map(r => (
                <div key={r.funcionalidade}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-heading font-medium text-nex-gray-800">{nomeAmigavel(r.funcionalidade)}</span>
                    <span className="text-sm font-heading font-semibold text-nex-black">{formatUsd(r.custoUsd)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-nex-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-nex-yellow rounded-full"
                      style={{ width: `${Math.max(2, (r.custoUsd / maiorCusto) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-nex-gray-400 mt-1">
                    {formatNumero(r.chamadas)} chamada{r.chamadas === 1 ? '' : 's'} · {formatNumero(r.tokensInput)} tokens de entrada · {formatNumero(r.tokensOutput)} tokens de saída
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
