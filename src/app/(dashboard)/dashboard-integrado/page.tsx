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

export default function DashboardIntegradoPage() {
  const [de, setDe] = useState(inicioMes())
  const [ate, setAte] = useState(hoje())
  const [presetAtivo, setPresetAtivo] = useState(1)

  const [visitas, setVisitas] = useState<Visita[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [oportunidades, setOportunidades] = useState<OportunidadesResponse | null>(null)
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

  // Recarrega tudo sempre que o período muda
  useEffect(() => {
    carregarVisitas()
    carregarReservas()
    carregarOportunidades()
  }, [carregarVisitas, carregarReservas, carregarOportunidades])

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

  // Oportunidades vem do RD CRM (sistema externo, sem canal de tempo real) — atualiza por polling.
  useEffect(() => {
    const id = setInterval(() => carregarOportunidades(), 60_000)
    return () => clearInterval(id)
  }, [carregarOportunidades])

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

  return (
    <div>
      <PageHeader
        title="Dashboard Integrado"
        description="Visão consolidada de Oportunidades, Visitas Agendadas e Registro de Reservas em um só lugar."
        actions={
          ultimaAtualizacao ? (
            <span className="text-[11px] text-nex-gray-400">
              Atualizado às {ultimaAtualizacao.toLocaleTimeString('pt-BR')}
            </span>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
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

      <div className="space-y-5">
        <SectionCard
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
              <StatTile icon={Trophy} label="Closer | Deal · EP" value={carregandoOportunidades ? '…' : oportunidades?.totalCloser ?? 0} />
              <StatTile icon={Users} label="Funis detectados" value={carregandoOportunidades ? '…' : oportunidades?.funnels?.length ?? 0} />
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={UserCheck}
          title="Visitas Agendadas"
          subtitle="Registro de Visita"
          actions={<IndicadorAoVivo label="Ao vivo" />}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile icon={UserCheck} label="Total de Visitas" value={totalVisitas} />
            <StatTile icon={CheckCircle2} label="Shows" value={shows} tone="success" />
            <StatTile icon={XCircle} label="No-Shows" value={noShows} tone={noShows > 0 ? 'warning' : 'default'} />
            <StatTile icon={Percent} label="Taxa de Show" value={`${taxaShow}%`} />
          </div>
        </SectionCard>

        <SectionCard
          icon={CalendarCheck}
          title="Registro de Reservas"
          subtitle="Reuniões e Primeiro Uso"
          actions={<IndicadorAoVivo label="Ao vivo" />}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile icon={CalendarCheck} label="Total no período" value={totalReservas} />
            <StatTile icon={MapPin} label="Francisco Rocha" value={porUnidade.francisco_rocha} />
            <StatTile icon={MapPin} label="Nex House" value={porUnidade.nex_house} />
            <StatTile icon={Users} label="Reunião — Primeira vez" value={porTipo.primeira_vez} />
            <StatTile icon={Clock} label="Reunião — 4h ou mais" value={porTipo.quatro_horas} />
            <StatTile icon={Sun} label="1º Uso — Diária" value={porTipo.primeiro_uso_diaria} />
            <StatTile icon={Ticket} label="1º Uso — Access Pass" value={porTipo.primeiro_uso_access_pass} />
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
