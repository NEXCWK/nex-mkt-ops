'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { Loader2, RefreshCw, Trophy, AlertCircle, CalendarDays, TrendingUp } from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface StageCount { stageName: string; count: number; isCloser: boolean }

interface DealRow {
  id: string; name: string; stage: string; isCloser?: boolean
  created_at: string; win?: boolean | null
}

interface FunnelData {
  id: string; name: string; isEP: boolean
  total: number
  closerCount: number | null
  closerStageName: string | null
  byStage: StageCount[]
  byMonth: Record<string, number>
  allDeals: DealRow[]
  closerDeals: DealRow[]
}

interface ApiResponse {
  funnels: FunnelData[]; totalGeral: number; totalCloser: number
  de?: string; ate?: string; error?: string
}

// ── Helpers de data ───────────────────────────────────────────────────────────

function hoje() { return new Date().toISOString().slice(0, 10) }
function subtractMonths(n: number) {
  const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10)
}
function inicioAno() { return `${new Date().getFullYear()}-01-01` }

const PRESETS = [
  { label: 'Este mês',       de: () => new Date().toISOString().slice(0, 8) + '01', ate: hoje },
  { label: 'Últimos 3 meses', de: () => subtractMonths(3), ate: hoje },
  { label: 'Últimos 6 meses', de: () => subtractMonths(6), ate: hoje },
  { label: 'Este ano',        de: inicioAno, ate: hoje },
]

const MONTH_LABELS: Record<string, string> = {
  '01':'Jan','02':'Fev','03':'Mar','04':'Abr','05':'Mai','06':'Jun',
  '07':'Jul','08':'Ago','09':'Set','10':'Out','11':'Nov','12':'Dez',
}
function fmtMonth(ym: string) {
  const [y, m] = ym.split('-')
  return `${MONTH_LABELS[m] ?? m}/${y?.slice(2)}`
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}
function fmtPeriod(de?: string, ate?: string) {
  if (!de && !ate) return 'Todo o período'
  const fmt = (d?: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '…'
  return `${fmt(de)} — ${fmt(ate)}`
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function MiniBar({ value, max, highlight }: { value: number; max: number; highlight?: boolean }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-nex-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', highlight ? 'bg-amber-400' : 'bg-nex-black')}
          style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-nex-gray-600 w-6 text-right tabular-nums">{value}</span>
    </div>
  )
}

function MonthChart({ byMonth }: { byMonth: Record<string, number> }) {
  const sorted = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
  const max = Math.max(...sorted.map(([, v]) => v), 1)
  if (sorted.length === 0) return <p className="text-xs text-nex-gray-300 py-2">Sem dados no período.</p>
  return (
    <div className="flex items-end gap-1 h-16 mt-2">
      {sorted.map(([ym, count]) => (
        <div key={ym} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
          {count > 0 && <span className="text-[8px] text-nex-gray-400 leading-none">{count}</span>}
          <div className="w-full bg-nex-black rounded-t-sm"
            style={{ height: `${Math.max(3, (count / max) * 48)}px` }}
            title={`${fmtMonth(ym)}: ${count}`} />
          <span className="text-[7px] text-nex-gray-300 truncate w-full text-center">{fmtMonth(ym)}</span>
        </div>
      ))}
    </div>
  )
}

function DealsTable({ deals, showCloserBadge }: { deals: DealRow[]; showCloserBadge?: boolean }) {
  if (deals.length === 0)
    return <div className="py-8 text-center text-sm text-nex-gray-300">Nenhuma negociação no período.</div>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-nex-gray-100">
            {['Nome', 'Etapa', 'Criado em'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deals.map((d, i) => (
            <tr key={d.id} className={cn('border-b border-nex-gray-50 hover:bg-nex-gray-50', i % 2 !== 0 && 'bg-white')}>
              <td className="px-4 py-2.5 text-nex-gray-800 max-w-[220px] truncate font-medium">{d.name}</td>
              <td className="px-4 py-2.5">
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-heading font-semibold',
                  (d.isCloser || (showCloserBadge && d.stage.toLowerCase().includes('deal')))
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-nex-gray-50 text-nex-gray-600'
                )}>
                  {(d.isCloser) && <Trophy className="w-2.5 h-2.5" />}
                  {d.stage}
                </span>
              </td>
              <td className="px-4 py-2.5 text-nex-gray-400 text-xs whitespace-nowrap">{fmtDate(d.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tab de funil ──────────────────────────────────────────────────────────────

function FunnelTab({ funnel, periodo }: { funnel: FunnelData; periodo: string }) {
  const maxStage = Math.max(...funnel.byStage.map(s => s.count), 1)
  const [subTab, setSubTab] = useState<'todas' | 'closer'>('todas')

  return (
    <div className="space-y-5">
      {/* Cards */}
      <div className={cn('grid gap-4', funnel.isEP ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2')}>
        <div className="bg-white border border-nex-gray-200 rounded-xl px-5 py-4">
          <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Oportunidades Criadas</p>
          <p className="text-3xl font-bold text-nex-black">{funnel.total}</p>
          <p className="text-xs text-nex-gray-400 mt-0.5">{periodo}</p>
        </div>

        {funnel.isEP && (
          <div className="bg-white border border-amber-200 rounded-xl px-5 py-4">
            <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-amber-600 mb-1">
              {funnel.closerStageName ?? 'Closer | Deal'}
            </p>
            <p className="text-3xl font-bold text-amber-600">{funnel.closerCount ?? 0}</p>
            <p className="text-xs text-nex-gray-400 mt-0.5">
              {funnel.total > 0
                ? `${Math.round(((funnel.closerCount ?? 0) / funnel.total) * 100)}% das oportunidades`
                : 'no período'}
            </p>
          </div>
        )}

        <div className="bg-white border border-nex-gray-200 rounded-xl px-5 py-4">
          <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Por Mês</p>
          <MonthChart byMonth={funnel.byMonth} />
        </div>
      </div>

      {/* Distribuição por etapa */}
      <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
        <div className="border-b border-nex-gray-100 px-4 py-2.5">
          <span className="text-xs font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Distribuição por Etapa</span>
        </div>
        <div className="p-4 space-y-2.5">
          {funnel.byStage.map(s => (
            <div key={s.stageName}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn('text-xs truncate max-w-[260px]', s.isCloser ? 'text-amber-700 font-semibold' : 'text-nex-gray-700')}>
                  {s.stageName}
                  {s.isCloser && <Trophy className="inline w-3 h-3 text-amber-500 ml-1" />}
                </span>
              </div>
              <MiniBar value={s.count} max={maxStage} highlight={s.isCloser} />
            </div>
          ))}
          {funnel.byStage.every(s => s.count === 0) && (
            <p className="text-sm text-nex-gray-300 text-center py-4">Nenhuma negociação no período.</p>
          )}
        </div>
      </div>

      {/* Lista de negociações */}
      <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
        <div className="border-b border-nex-gray-100 px-4 py-2.5 flex items-center gap-3">
          {funnel.isEP ? (
            <>
              <button onClick={() => setSubTab('todas')}
                className={cn('text-xs font-heading font-medium px-3 py-1 rounded-md transition-colors',
                  subTab === 'todas' ? 'bg-nex-gray-100 text-nex-black' : 'text-nex-gray-400 hover:text-nex-black')}>
                Todas ({funnel.total})
              </button>
              <button onClick={() => setSubTab('closer')}
                className={cn('text-xs font-heading font-medium px-3 py-1 rounded-md transition-colors flex items-center gap-1',
                  subTab === 'closer' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'text-nex-gray-400 hover:text-amber-600')}>
                <Trophy className="w-3 h-3" />
                {funnel.closerStageName ?? 'Closer | Deal'} ({funnel.closerCount ?? 0})
              </button>
            </>
          ) : (
            <span className="text-xs font-heading font-semibold uppercase tracking-wide text-nex-gray-400">
              Negociações ({funnel.total})
            </span>
          )}
        </div>
        <DealsTable
          deals={subTab === 'closer' ? funnel.closerDeals : funnel.allDeals}
          showCloserBadge={subTab === 'todas' && funnel.isEP}
        />
        {((subTab === 'todas' && funnel.total > 100) || (subTab === 'closer' && (funnel.closerCount ?? 0) > 100)) && (
          <p className="text-[11px] text-nex-gray-300 text-center px-4 py-2 border-t border-nex-gray-50">
            Exibindo os 100 mais recentes. Refine o período para ver todos.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function OportunidadesPage() {
  const [data, setData]           = useState<ApiResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState<'geral' | string>('geral')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Filtro de período — padrão: últimos 3 meses
  const [de,  setDe]  = useState(subtractMonths(3))
  const [ate, setAte] = useState(hoje())
  const [activePreset, setActivePreset] = useState(1) // "Últimos 3 meses"

  const load = useCallback(async (d = de, a = ate) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ de: d, ate: a })
      const res = await fetch(`/api/oportunidades?${params}`)
      const json = await res.json()
      setData(json)
      setLastUpdate(new Date())
    } catch {
      setData({ funnels: [], totalGeral: 0, totalCloser: 0, error: 'Falha ao carregar dados.' })
    } finally {
      setLoading(false)
    }
  }, [de, ate])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function applyPreset(idx: number) {
    const p = PRESETS[idx]
    const d = p.de(), a = p.ate()
    setDe(d); setAte(a); setActivePreset(idx); load(d, a)
  }

  function applyCustom() { setActivePreset(-1); load(de, ate) }

  const epFunnels = data?.funnels?.filter(f => f.isEP) ?? []
  const periodo   = fmtPeriod(de, ate)

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <PageHeader
        title="Oportunidades Geradas"
        description="Negociações criadas por funil no RD CRM, com detalhamento por etapa e período."
        actions={
          <button onClick={() => load()} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-nex-gray-400 hover:text-nex-black transition-colors disabled:opacity-40">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            {lastUpdate
              ? `Atualizado ${lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : 'Atualizar'}
          </button>
        }
      />

      {/* ── Filtro de período ── */}
      <div className="flex items-center gap-3 flex-wrap mb-5 bg-white border border-nex-gray-200 rounded-xl px-4 py-3">
        <CalendarDays className="w-3.5 h-3.5 text-nex-gray-400 flex-shrink-0" />
        <div className="flex gap-1.5 flex-wrap">
          {PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => applyPreset(i)}
              className={cn('px-3 py-1 rounded-md text-xs font-heading font-medium transition-colors',
                activePreset === i
                  ? 'bg-nex-black text-white'
                  : 'bg-nex-gray-50 text-nex-gray-500 hover:bg-nex-gray-100')}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" value={de} onChange={e => { setDe(e.target.value); setActivePreset(-1) }}
            className="rounded-md border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          <span className="text-xs text-nex-gray-400">até</span>
          <input type="date" value={ate} onChange={e => { setAte(e.target.value); setActivePreset(-1) }}
            className="rounded-md border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          <button onClick={applyCustom}
            className="px-3 py-1 rounded-md bg-nex-black text-white text-xs font-heading font-medium hover:bg-nex-gray-700 transition-colors">
            Aplicar
          </button>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      {loading && !data ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-nex-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Carregando dados do RD CRM…</span>
        </div>
      ) : data?.error ? (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-6 py-4">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700">Erro ao conectar com RD CRM</p>
            <p className="text-xs text-red-500 mt-0.5">{data.error}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Cards gerais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="bg-white border border-nex-gray-200 rounded-xl px-5 py-4">
              <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Total Geral</p>
              <p className="text-3xl font-bold text-nex-black">{data?.totalGeral ?? 0}</p>
              <p className="text-xs text-nex-gray-400 mt-0.5">Todos os funis · {periodo}</p>
            </div>
            <div className="bg-white border border-nex-gray-200 rounded-xl px-5 py-4">
              <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Funis</p>
              <p className="text-3xl font-bold text-nex-black">{data?.funnels?.length ?? 0}</p>
              <p className="text-xs text-nex-gray-400 mt-0.5">Detectados no RD CRM</p>
            </div>
            <div className="bg-white border border-nex-gray-200 rounded-xl px-5 py-4">
              <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Oportunidades EP</p>
              <p className="text-3xl font-bold text-nex-black">
                {epFunnels.reduce((s, f) => s + f.total, 0)}
              </p>
              <p className="text-xs text-nex-gray-400 mt-0.5">Escritório Privativo (todos)</p>
            </div>
            <div className="bg-white border border-amber-200 rounded-xl px-5 py-4">
              <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-amber-600 mb-1">
                {epFunnels[0]?.closerStageName ?? 'Closer | Deal'} · EP
              </p>
              <p className="text-3xl font-bold text-amber-600">{data?.totalCloser ?? 0}</p>
              <p className="text-xs text-nex-gray-400 mt-0.5">Soma FCO + CPE</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 mb-5 flex-wrap">
            <button onClick={() => setActiveTab('geral')}
              className={cn('px-4 py-1.5 rounded-lg text-xs font-heading font-medium border transition-colors',
                activeTab === 'geral'
                  ? 'border-nex-black bg-nex-gray-50 text-nex-black'
                  : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
              Visão Geral
            </button>
            {data?.funnels?.map(f => (
              <button key={f.id} onClick={() => setActiveTab(f.id)}
                className={cn('px-4 py-1.5 rounded-lg text-xs font-heading font-medium border transition-colors flex items-center gap-1.5',
                  activeTab === f.id
                    ? 'border-nex-black bg-nex-gray-50 text-nex-black'
                    : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
                {f.name}
                {f.isEP && (
                  <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">EP</span>
                )}
                <span className={cn('text-[10px] font-bold tabular-nums',
                  activeTab === f.id ? 'text-nex-black' : 'text-nex-gray-400')}>
                  {f.total}
                </span>
              </button>
            ))}
          </div>

          {/* Conteúdo da tab */}
          {activeTab === 'geral' ? (
            <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
              <div className="border-b border-nex-gray-100 px-5 py-3 flex items-center justify-between">
                <span className="text-xs font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Resumo por Funil</span>
                <span className="text-xs text-nex-gray-400">{periodo}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-nex-gray-100">
                    {['Funil', 'Oportunidades', 'Closer | Deal', 'Distribuição por etapa'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.funnels ?? []).map((f, i) => {
                    const maxS = Math.max(...f.byStage.map(s => s.count), 1)
                    return (
                      <tr key={f.id}
                        onClick={() => setActiveTab(f.id)}
                        className={cn('border-b border-nex-gray-50 hover:bg-nex-gray-50 cursor-pointer transition-colors', i % 2 !== 0 && 'bg-white')}>
                        <td className="px-5 py-3 font-medium text-nex-gray-800">
                          <span className="flex items-center gap-2">
                            {f.name}
                            {f.isEP && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">EP</span>}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-bold text-nex-black tabular-nums">{f.total}</td>
                        <td className="px-5 py-3 tabular-nums">
                          {f.isEP
                            ? <span className="font-bold text-amber-600">{f.closerCount ?? 0}</span>
                            : <span className="text-nex-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3 min-w-[180px]">
                          <div className="flex gap-px h-5 items-end">
                            {f.byStage.map(s => (
                              <div key={s.stageName}
                                className={cn('flex-1 rounded-sm', s.isCloser ? 'bg-amber-400' : 'bg-nex-black opacity-70')}
                                style={{ height: `${Math.max(2, (s.count / maxS) * 20)}px` }}
                                title={`${s.stageName}: ${s.count}`} />
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {loading && (
                <div className="flex items-center justify-center gap-2 py-4 text-nex-gray-400 border-t border-nex-gray-50">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Atualizando…</span>
                </div>
              )}
            </div>
          ) : (
            data?.funnels?.find(f => f.id === activeTab) && (
              <FunnelTab
                funnel={data.funnels.find(f => f.id === activeTab)!}
                periodo={periodo}
              />
            )
          )}
        </>
      )}
    </div>
  )
}
