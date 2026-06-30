'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { Loader2, TrendingUp, RefreshCw, Trophy, AlertCircle } from 'lucide-react'

interface StageCount {
  stageName: string
  count: number
}

interface FunnelData {
  id: string
  name: string
  isEP: boolean
  total: number
  dealsCount: number | null
  byStage: StageCount[]
  byMonth: Record<string, number>
  recentDeals: {
    id: string
    name: string
    stage: string
    created_at: string
    win: boolean | null
    amount: number | null
  }[]
}

interface ApiResponse {
  funnels: FunnelData[]
  totalGeral: number
  error?: string
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
}

function formatMonth(ym: string) {
  const [y, m] = ym.split('-')
  return `${MONTH_LABELS[m] ?? m}/${y?.slice(2)}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-nex-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-nex-black rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-nex-gray-600 w-6 text-right">{value}</span>
    </div>
  )
}

function MonthChart({ byMonth }: { byMonth: Record<string, number> }) {
  const sorted = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
  const max = Math.max(...sorted.map(([, v]) => v), 1)
  return (
    <div className="flex items-end gap-1.5 h-20 mt-3">
      {sorted.map(([ym, count]) => (
        <div key={ym} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <span className="text-[9px] text-nex-gray-400">{count > 0 ? count : ''}</span>
          <div
            className="w-full bg-nex-black rounded-t-sm"
            style={{ height: `${Math.max(4, (count / max) * 60)}px` }}
            title={`${formatMonth(ym)}: ${count}`}
          />
          <span className="text-[8px] text-nex-gray-300 truncate w-full text-center">{formatMonth(ym)}</span>
        </div>
      ))}
    </div>
  )
}

function FunnelTab({ funnel }: { funnel: FunnelData }) {
  const maxStage = Math.max(...funnel.byStage.map(s => s.count), 1)

  return (
    <div className="space-y-5">
      {/* Cards topo */}
      <div className={cn('grid gap-4', funnel.isEP ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2')}>
        <div className="bg-white border border-nex-gray-200 rounded-xl px-5 py-4">
          <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Total de Oportunidades</p>
          <p className="text-3xl font-bold text-nex-black">{funnel.total}</p>
          <p className="text-xs text-nex-gray-400 mt-0.5">Todas as colunas</p>
        </div>
        {funnel.isEP && (
          <div className="bg-white border border-nex-gray-200 rounded-xl px-5 py-4">
            <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Coluna Deals</p>
            <p className="text-3xl font-bold text-green-600">{funnel.dealsCount ?? '—'}</p>
            <p className="text-xs text-nex-gray-400 mt-0.5">Negociações na etapa Deals</p>
          </div>
        )}
        <div className="bg-white border border-nex-gray-200 rounded-xl px-5 py-4">
          <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-2">Tendência (12 meses)</p>
          <MonthChart byMonth={funnel.byMonth} />
        </div>
      </div>

      {/* Por etapa + Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Distribuição por etapa */}
        <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
          <div className="border-b border-nex-gray-100 px-4 py-2.5">
            <span className="text-xs font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Por Etapa do Funil</span>
          </div>
          <div className="p-4 space-y-2.5">
            {funnel.byStage.filter(s => s.count > 0 || funnel.byStage.length < 15).map(s => (
              <div key={s.stageName}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-nex-gray-700 truncate max-w-[200px]">{s.stageName}</span>
                  {funnel.isEP && s.stageName.toLowerCase().includes('deal') && (
                    <Trophy className="w-3 h-3 text-amber-500 flex-shrink-0 mr-1" />
                  )}
                </div>
                <MiniBar value={s.count} max={maxStage} />
              </div>
            ))}
            {funnel.byStage.every(s => s.count === 0) && (
              <p className="text-sm text-nex-gray-300 text-center py-4">Nenhuma negociação neste funil.</p>
            )}
          </div>
        </div>

        {/* Recentes */}
        <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
          <div className="border-b border-nex-gray-100 px-4 py-2.5">
            <span className="text-xs font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Negociações Recentes</span>
          </div>
          <div className="overflow-auto max-h-72">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nex-gray-50">
                  <th className="px-4 py-2 text-left text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Nome</th>
                  <th className="px-4 py-2 text-left text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Etapa</th>
                  <th className="px-4 py-2 text-left text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400 whitespace-nowrap">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {funnel.recentDeals.map((d, i) => (
                  <tr key={d.id} className={cn('border-b border-nex-gray-50 hover:bg-nex-gray-50', i % 2 === 0 ? '' : 'bg-white')}>
                    <td className="px-4 py-2 text-nex-gray-800 max-w-[180px] truncate">{d.name}</td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-[10px] font-heading font-semibold',
                        d.stage.toLowerCase().includes('deal')
                          ? 'bg-amber-50 text-amber-700'
                          : d.win
                            ? 'bg-green-50 text-green-700'
                            : 'bg-nex-gray-50 text-nex-gray-600'
                      )}>
                        {d.stage}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-nex-gray-400 text-xs whitespace-nowrap">{formatDate(d.created_at)}</td>
                  </tr>
                ))}
                {funnel.recentDeals.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-nex-gray-300">Sem negociações.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OportunidadesPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'geral' | string>('geral')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/oportunidades')
      const json = await res.json()
      setData(json)
      setLastUpdate(new Date())
    } catch {
      setData({ funnels: [], totalGeral: 0, error: 'Falha ao carregar dados.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const epFunnel = data?.funnels?.find(f => f.isEP)
  const totalOp = data?.totalGeral ?? 0
  const totalDeals = epFunnel?.dealsCount ?? 0
  const numFunnels = data?.funnels?.length ?? 0

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <PageHeader
        title="Oportunidades Geradas"
        description="Negociações criadas no RD CRM por funil, com acompanhamento de etapas e tendência mensal."
        actions={
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-nex-gray-400 hover:text-nex-black transition-colors disabled:opacity-40">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            {lastUpdate ? `Atualizado ${lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Atualizar'}
          </button>
        }
      />

      {loading && !data ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-nex-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Carregando dados do RD CRM…</span>
        </div>
      ) : data?.error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-6 py-4 max-w-lg">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700">Erro ao conectar com RD CRM</p>
              <p className="text-xs text-red-500 mt-0.5">{data.error}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Cards gerais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            {[
              { label: 'Total de Oportunidades', value: totalOp, sub: 'Todos os funis', icon: TrendingUp, color: 'text-nex-black' },
              { label: 'Funis Ativos', value: numFunnels, sub: 'No RD CRM', icon: TrendingUp, color: 'text-nex-black' },
              { label: 'Oportunidades EP', value: epFunnel?.total ?? 0, sub: 'Escritório Privativo', icon: TrendingUp, color: 'text-nex-black' },
              { label: 'Deals EP', value: totalDeals, sub: 'Coluna Deals · EP', icon: Trophy, color: 'text-green-600' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-white border border-nex-gray-200 rounded-xl px-5 py-4">
                <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">{label}</p>
                <p className={cn('text-3xl font-bold', color)}>{value}</p>
                <p className="text-xs text-nex-gray-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-5 flex-wrap">
            <button onClick={() => setActiveTab('geral')}
              className={cn('px-4 py-1.5 rounded-lg text-xs font-heading font-medium border transition-colors',
                activeTab === 'geral' ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
              Visão Geral
            </button>
            {data?.funnels?.map(f => (
              <button key={f.id} onClick={() => setActiveTab(f.id)}
                className={cn('px-4 py-1.5 rounded-lg text-xs font-heading font-medium border transition-colors',
                  activeTab === f.id ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
                {f.name}
                {f.isEP && <span className="ml-1.5 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">EP</span>}
              </button>
            ))}
          </div>

          {/* Conteúdo da tab */}
          {activeTab === 'geral' ? (
            <div className="space-y-4">
              {/* Tabela resumo por funil */}
              <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
                <div className="border-b border-nex-gray-100 px-5 py-3">
                  <span className="text-xs font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Resumo por Funil</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-nex-gray-100">
                      <th className="px-5 py-3 text-left text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Funil</th>
                      <th className="px-5 py-3 text-right text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Oportunidades</th>
                      <th className="px-5 py-3 text-right text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Deals (EP)</th>
                      <th className="px-5 py-3 text-left text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Distribuição por etapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.funnels?.map((f, i) => {
                      const maxS = Math.max(...f.byStage.map(s => s.count), 1)
                      return (
                        <tr key={f.id} className={cn('border-b border-nex-gray-50 hover:bg-nex-gray-50 cursor-pointer', i % 2 === 0 ? '' : 'bg-white')}
                          onClick={() => setActiveTab(f.id)}>
                          <td className="px-5 py-3 font-medium text-nex-gray-800">
                            {f.name}
                            {f.isEP && <span className="ml-2 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">EP</span>}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-nex-black">{f.total}</td>
                          <td className="px-5 py-3 text-right">
                            {f.isEP ? (
                              <span className="font-bold text-green-600">{f.dealsCount ?? '—'}</span>
                            ) : (
                              <span className="text-nex-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3 min-w-[200px]">
                            <div className="flex gap-0.5 h-4 items-end">
                              {f.byStage.slice(0, 10).map(s => (
                                <div key={s.stageName}
                                  className="flex-1 bg-nex-black rounded-sm opacity-80"
                                  style={{ height: `${Math.max(2, (s.count / maxS) * 16)}px` }}
                                  title={`${s.stageName}: ${s.count}`}
                                />
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            data?.funnels?.find(f => f.id === activeTab) && (
              <FunnelTab funnel={data.funnels.find(f => f.id === activeTab)!} />
            )
          )}
        </>
      )}
    </div>
  )
}
