'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard } from '@/components/layout/SectionCard'
import { StatTile } from '@/components/layout/StatTile'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Lightbulb, UserCheck, CalendarCheck, CheckCircle2, XCircle, Percent,
  Building2, MapPin, Users, Clock, Sun, Ticket, Trophy, AlertCircle,
  FileText, Mail, Target, Handshake, Megaphone, MessageSquare, Coins, LayoutGrid,
} from 'lucide-react'

interface Visita {
  id: string
  compareceu: boolean
}

type TipoReserva = 'primeira_vez' | 'quatro_horas' | 'primeiro_uso_diaria' | 'primeiro_uso_access_pass'

interface Reserva {
  id: string
  tipo: TipoReserva
  unidade: 'nex_house' | 'francisco_rocha'
}

interface FunnelData {
  id: string; name: string; isEP: boolean; total: number
}

interface OportunidadesResponse {
  funnels: FunnelData[]; totalGeral: number; totalCloser: number; error?: string
}

interface OutrasMetricas {
  contratos: { total: number }
  emails: { total: number }
  prospeccao: { totalEmpresas: number; totalListasBdr: number; totalListasParcerias: number }
  cco: { totalContatos: number } | null
  avaliacao: { atendimentos: { total: number; notaMedia: number }; telefonemas: { total: number; notaMedia: number } } | null
  tokens: { custoTotalUsd: number } | null
}

function hoje() { return new Date().toISOString().slice(0, 10) }
function inicioMes() { return new Date().toISOString().slice(0, 8) + '01' }
function inicioAno() { return `${new Date().getFullYear()}-01-01` }

const PRESETS = [
  { label: 'Hoje', de: hoje, ate: hoje },
  { label: 'Este mês', de: inicioMes, ate: hoje },
  { label: 'Este ano', de: inicioAno, ate: hoje },
]

/** Bolinha pulsante indicando que a seção atualiza sozinha (Supabase Realtime ou polling). */
function IndicadorAoVivo({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-heading font-semibold uppercase tracking-wide text-green-600">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      {label}
    </span>
  )
}

/** Rótulo pequeno para agrupar um subconjunto de StatTiles dentro de uma seção (hierarquia visual). */
function Subgrupo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-2">{label}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>
    </div>
  )
}

function formatUsd(v: number): string {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DashboardIntegradoPage() {
  const [de, setDe] = useState(inicioMes())
  const [ate, setAte] = useState(hoje())
  const [presetAtivo, setPresetAtivo] = useState(1)

  const [visitas, setVisitas] = useState<Visita[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [oportunidades, setOportunidades] = useState<OportunidadesResponse | null>(null)
  const [outras, setOutras] = useState<OutrasMetricas | null>(null)
  const [carregandoOportunidades, setCarregandoOportunidades] = useState(true)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null)

  const carregarVisitas = useCallback(async () => {
    const params = new URLSearchParams({ de, ate })
    const res = await fetch(`/api/registro-visitas?${params}`)
    const json = await res.json().catch(() => ({}))
    setVisitas(json.visitas ?? [])
    setUltimaAtualizacao(new Date())
  }, [de, ate])

  const carregarReservas = useCallback(async () => {
    const params = new URLSearchParams({ de, ate })
    const res = await fetch(`/api/registro-reservas?${params}`)
    const json = await res.json().catch(() => ({}))
    setReservas(json.registros ?? [])
    setUltimaAtualizacao(new Date())
  }, [de, ate])

  const carregarOportunidades = useCallback(async () => {
    setCarregandoOportunidades(true)
    try {
      const params = new URLSearchParams({ de, ate })
      const res = await fetch(`/api/oportunidades?${params}`)
      const json = await res.json()
      setOportunidades(json)
    } catch {
      setOportunidades({ funnels: [], totalGeral: 0, totalCloser: 0, error: 'Falha ao consultar o RD CRM' })
    } finally {
      setCarregandoOportunidades(false)
      setUltimaAtualizacao(new Date())
    }
  }, [de, ate])

  const carregarOutras = useCallback(async () => {
    const params = new URLSearchParams({ de, ate })
    const res = await fetch(`/api/dashboard-integrado?${params}`)
    const json = await res.json().catch(() => null)
    setOutras(json)
    setUltimaAtualizacao(new Date())
  }, [de, ate])

  // Recarrega tudo sempre que o período muda
  useEffect(() => {
    carregarVisitas()
    carregarReservas()
    carregarOportunidades()
    carregarOutras()
  }, [carregarVisitas, carregarReservas, carregarOportunidades, carregarOutras])

  // Registro de Reservas e Registro de Visita ficam "ao vivo" via Supabase Realtime —
  // qualquer novo registro/alteração feito nessas abas atualiza este dashboard na hora.
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-integrado')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registro_reservas' }, () => carregarReservas())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registro_visitas' }, () => carregarVisitas())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [carregarReservas, carregarVisitas])

  // Oportunidades (RD CRM) e as métricas agregadas não têm canal de tempo real — atualizam por polling.
  useEffect(() => {
    const id = setInterval(() => { carregarOportunidades(); carregarOutras() }, 60_000)
    return () => clearInterval(id)
  }, [carregarOportunidades, carregarOutras])

  function aplicarPreset(i: number) {
    setPresetAtivo(i)
    setDe(PRESETS[i].de())
    setAte(PRESETS[i].ate())
  }

  // ── Visitas ──
  const totalVisitas = visitas.length
  const shows = visitas.filter(v => v.compareceu).length
  const noShows = visitas.filter(v => !v.compareceu).length
  const taxaShow = totalVisitas > 0 ? Math.round((shows / totalVisitas) * 100) : 0

  // ── Reservas ──
  const totalReservas = reservas.length
  const porUnidade = {
    francisco_rocha: reservas.filter(r => r.unidade === 'francisco_rocha').length,
    nex_house: reservas.filter(r => r.unidade === 'nex_house').length,
  }
  const porTipo = {
    primeira_vez: reservas.filter(r => r.tipo === 'primeira_vez').length,
    quatro_horas: reservas.filter(r => r.tipo === 'quatro_horas').length,
    primeiro_uso_diaria: reservas.filter(r => r.tipo === 'primeiro_uso_diaria').length,
    primeiro_uso_access_pass: reservas.filter(r => r.tipo === 'primeiro_uso_access_pass').length,
  }

  // ── Oportunidades ──
  const epFunnels = oportunidades?.funnels?.filter(f => f.isEP) ?? []
  const oportunidadesEP = epFunnels.reduce((s, f) => s + f.total, 0)

  const temOutrasMetricas = !!outras && (
    outras.contratos.total > 0 || outras.emails.total > 0 || outras.prospeccao.totalEmpresas > 0 ||
    !!outras.cco || !!outras.avaliacao || !!outras.tokens
  )

  return (
    <div>
      <PageHeader
        title="Dashboard Integrado"
        description="Visão consolidada das principais métricas do sistema, atualizada conforme cada aba é usada."
        actions={
          ultimaAtualizacao ? (
            <span className="text-[11px] text-nex-gray-400">
              Atualizado às {ultimaAtualizacao.toLocaleTimeString('pt-BR')}
            </span>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {PRESETS.map((p, i) => (
          <button key={p.label} onClick={() => aplicarPreset(i)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-heading font-medium border transition-colors',
              presetAtivo === i ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
            {p.label}
          </button>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" value={de} onChange={e => { setDe(e.target.value); setPresetAtivo(-1) }}
            className="rounded-md border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          <span className="text-xs text-nex-gray-400">até</span>
          <input type="date" value={ate} onChange={e => { setAte(e.target.value); setPresetAtivo(-1) }}
            className="rounded-md border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
        </div>
      </div>

      {/* ── Métricas principais (o funil comercial: gerar → visitar → converter) ── */}
      <div className="space-y-5">
        <SectionCard
          step={1}
          icon={Lightbulb}
          title="Oportunidades Geradas"
          subtitle="RD CRM · atualiza a cada 60s (sistema externo, sem canal de tempo real)"
        >
          {oportunidades?.error ? (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{oportunidades.error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile icon={Lightbulb} label="Total Geral" value={carregandoOportunidades ? '…' : oportunidades?.totalGeral ?? 0} />
              <StatTile icon={Building2} label="Oportunidades EP" value={carregandoOportunidades ? '…' : oportunidadesEP} />
              <StatTile icon={Trophy} label="Closer | Deal · EP" value={carregandoOportunidades ? '…' : oportunidades?.totalCloser ?? 0} tone="success" />
              <StatTile icon={Users} label="Funis detectados" value={carregandoOportunidades ? '…' : oportunidades?.funnels?.length ?? 0} />
            </div>
          )}
        </SectionCard>

        <SectionCard
          step={2}
          icon={UserCheck}
          title="Visitas Agendadas"
          subtitle="Registro de Visita"
          actions={<IndicadorAoVivo label="Ao vivo" />}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile icon={UserCheck} label="Total de Visitas" value={totalVisitas} />
            <StatTile icon={CheckCircle2} label="Shows" value={shows} tone="success" />
            <StatTile icon={XCircle} label="No-Shows" value={noShows} tone={noShows > 0 ? 'warning' : 'default'} />
            <StatTile icon={Percent} label="Taxa de Show" value={`${taxaShow}%`} tone={taxaShow >= 50 ? 'success' : 'warning'} />
          </div>
        </SectionCard>

        <SectionCard
          step={3}
          icon={CalendarCheck}
          title="Registro de Reservas"
          subtitle="Reuniões e Primeiro Uso"
          actions={<IndicadorAoVivo label="Ao vivo" />}
        >
          <div className="space-y-4">
            <Subgrupo label={`Por unidade · ${totalReservas} no total`}>
              <StatTile icon={CalendarCheck} label="Total no período" value={totalReservas} />
              <StatTile icon={MapPin} label="Francisco Rocha" value={porUnidade.francisco_rocha} />
              <StatTile icon={MapPin} label="Nex House" value={porUnidade.nex_house} />
            </Subgrupo>
            <Subgrupo label="Por tipo de reserva">
              <StatTile icon={Users} label="Reunião — Primeira vez" value={porTipo.primeira_vez} />
              <StatTile icon={Clock} label="Reunião — 4h ou mais" value={porTipo.quatro_horas} />
              <StatTile icon={Sun} label="1º Uso — Diária" value={porTipo.primeiro_uso_diaria} />
              <StatTile icon={Ticket} label="1º Uso — Access Pass" value={porTipo.primeiro_uso_access_pass} />
            </Subgrupo>
          </div>
        </SectionCard>

        {/* ── Outras métricas do sistema ── */}
        {temOutrasMetricas && (
          <SectionCard
            step={4}
            icon={LayoutGrid}
            title="Outras Métricas"
            subtitle="Contratos, e-mails, prospecção e demais abas — atualiza a cada 60s"
          >
            <div className="space-y-4">
              <Subgrupo label="Documentos e E-mails">
                <StatTile icon={FileText} label="Contratos Gerados" value={outras?.contratos.total ?? 0} />
                <StatTile icon={Mail} label="E-mails Enviados" value={outras?.emails.total ?? 0} />
              </Subgrupo>

              <Subgrupo label="Prospecção · Sistema BDR e Parcerias">
                <StatTile icon={Target} label="Empresas Prospectadas" value={outras?.prospeccao.totalEmpresas ?? 0} />
                <StatTile icon={Target} label="Listas — BDR" value={outras?.prospeccao.totalListasBdr ?? 0} />
                <StatTile icon={Handshake} label="Listas — Parcerias" value={outras?.prospeccao.totalListasParcerias ?? 0} />
                {outras?.cco && <StatTile icon={Megaphone} label="Contatos — Sistema CCO" value={outras.cco.totalContatos} />}
              </Subgrupo>

              {outras?.avaliacao && (
                <Subgrupo label="Avaliação de Qualidade">
                  <StatTile icon={MessageSquare} label="Atendimentos Avaliados" value={outras.avaliacao.atendimentos.total} />
                  <StatTile icon={MessageSquare} label="Nota Média — Atendimentos" value={outras.avaliacao.atendimentos.notaMedia.toFixed(1)} tone={outras.avaliacao.atendimentos.notaMedia >= 7 ? 'success' : 'warning'} />
                  <StatTile icon={MessageSquare} label="Telefonemas Avaliados" value={outras.avaliacao.telefonemas.total} />
                  <StatTile icon={MessageSquare} label="Nota Média — Telefonemas" value={outras.avaliacao.telefonemas.notaMedia.toFixed(1)} tone={outras.avaliacao.telefonemas.notaMedia >= 7 ? 'success' : 'warning'} />
                </Subgrupo>
              )}

              {outras?.tokens && (
                <Subgrupo label="Custo de IA (Claude)">
                  <StatTile icon={Coins} label="Custo Estimado" value={formatUsd(outras.tokens.custoTotalUsd)} />
                </Subgrupo>
              )}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}
