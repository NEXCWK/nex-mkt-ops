'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { Send, Loader2, CalendarDays, Users, Clock, MapPin, SlidersHorizontal, RefreshCw } from 'lucide-react'

type Unidade = 'francisco_rocha' | 'nex_house'
type Tipo = 'primeira_vez' | 'quatro_horas'

interface Reserva {
  id: string
  tipo: Tipo
  nome_cliente: string
  data: string
  horario: string
  nome_sala: string
  quantidade_pessoas: number | null
  observacoes: string | null
  unidade: Unidade
  operador_email: string
  created_at: string
}

const UNIDADE_LABEL: Record<Unidade, string> = {
  francisco_rocha: 'Francisco Rocha',
  nex_house: 'Nex House',
}

const TIPO_LABEL: Record<Tipo, string> = {
  primeira_vez: 'Reunião — Primeira vez',
  quatro_horas: 'Reunião — 4 horas ou mais',
}

const SALAS_FCO = [
  'Sala R1 - 8 posições',
  'Sala R2 - 6 posições',
  'Sala R3 - 12 posições',
  'Sala R4 - 4 posições',
  'Sala C1 - 4 posições',
  'Sala C2 - 6 posições',
]
const SALAS_NH = [
  'Sala R1 - 4 posições',
  'Sala R2 - 8 posições',
  'Sala R3 - 6 posições',
]

const PRODUTOS = ['Escritório Virtual', 'Mesa Fixa', 'Escritório Privativo', 'Nex House — Atrium', 'Nex House — Gallery', 'Sala de Reunião', 'Todos']

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

function inicioMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function buildPreviewHtml(f: typeof EMPTY_FORM & { operador: string }) {
  if (!f.nome_cliente || !f.data || !f.horario || !f.nome_sala || !f.unidade) return null
  const dataFormatada = new Date(f.data + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
  const tipoLabel = f.tipo === 'primeira_vez' ? 'Reunião — Primeira vez' : 'Reunião — 4 horas ou mais'
  const unidadeLabel = UNIDADE_LABEL[f.unidade]
  const intro = f.tipo === 'primeira_vez'
    ? 'Uma nova reserva de sala foi registrada para um cliente <strong>de primeira vez</strong>. Fique de olho para garantir uma ótima experiência!'
    : 'Uma nova reserva de sala foi registrada para uma sessão de <strong>4 horas ou mais</strong>. Atenção especial ao acolhimento!'
  const destinatarios = f.unidade === 'francisco_rocha'
    ? 'felipe@nex.work, lenise@nex.work, edmilson@nex.work, virginia@nex.work, marialuiza@nex.work'
    : 'felipe@nex.work, lenise@nex.work, altieres@nex.work, lorena@nex.work'
  return { dataFormatada, tipoLabel, unidadeLabel, intro, destinatarios }
}

const EMPTY_FORM = {
  tipo: 'primeira_vez' as Tipo,
  nome_cliente: '',
  data: hoje(),
  horario: '',
  nome_sala: '',
  quantidade_pessoas: '',
  observacoes: '',
  unidade: 'francisco_rocha' as Unidade,
}

export default function RegistroReservasPage() {
  const [tab, setTab] = useState<Tipo>('primeira_vez')
  const [form, setForm] = useState({ ...EMPTY_FORM, tipo: 'primeira_vez' as Tipo })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [carregando, setCarregando] = useState(false)
  const [filtro, setFiltro] = useState({ de: inicioMes(), ate: hoje(), unidade: '', tipo: '' })
  const [operador, setOperador] = useState('')

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(s => {
      setOperador(s?.user?.nome ?? s?.user?.name ?? s?.user?.email ?? '')
    }).catch(() => {})
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    const params = new URLSearchParams()
    if (filtro.de) params.set('de', filtro.de)
    if (filtro.ate) params.set('ate', filtro.ate)
    if (filtro.unidade) params.set('unidade', filtro.unidade)
    if (filtro.tipo) params.set('tipo', filtro.tipo)
    const res = await fetch('/api/registro-reservas?' + params.toString())
    const json = await res.json()
    setReservas(json.registros ?? [])
    setCarregando(false)
  }, [filtro])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    setForm(prev => ({ ...prev, tipo: tab, nome_sala: '' }))
  }, [tab])

  const salas = form.unidade === 'nex_house' ? SALAS_NH : SALAS_FCO

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome_cliente || !form.data || !form.horario || !form.nome_sala) return
    setLoading(true)
    setErro(null)
    setSucesso(false)
    try {
      const res = await fetch('/api/registro-reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantidade_pessoas: form.quantidade_pessoas ? Number(form.quantidade_pessoas) : null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setSucesso(true)
      setForm({ ...EMPTY_FORM, tipo: tab })
      carregar()
      setTimeout(() => setSucesso(false), 4000)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar')
    } finally {
      setLoading(false)
    }
  }

  const preview = buildPreviewHtml({ ...form, operador })

  // Dashboard metrics
  const totalMes = reservas.length
  const porUnidade = {
    francisco_rocha: reservas.filter(r => r.unidade === 'francisco_rocha').length,
    nex_house: reservas.filter(r => r.unidade === 'nex_house').length,
  }
  const porTipo = {
    primeira_vez: reservas.filter(r => r.tipo === 'primeira_vez').length,
    quatro_horas: reservas.filter(r => r.tipo === 'quatro_horas').length,
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <PageHeader
        title="Registro de Reservas"
        description="Registre reservas de salas de reunião e notifique automaticamente a equipe da unidade."
      />

      {/* Sub-tabs */}
      <div className="flex gap-2 mb-5">
        {(['primeira_vez', 'quatro_horas'] as Tipo[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 rounded-lg text-xs font-heading font-medium border transition-colors',
              tab === t ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
            {TIPO_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-6">
        {/* Form */}
        <div className="bg-white border border-nex-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-heading font-semibold text-nex-black mb-4">{TIPO_LABEL[tab]}</h2>
          <form onSubmit={registrar} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-heading text-nex-gray-500 mb-1">Nome do Cliente *</label>
                <input required value={form.nome_cliente} onChange={e => setForm(p => ({ ...p, nome_cliente: e.target.value }))}
                  placeholder="Ex.: João Silva"
                  className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400 focus:border-nex-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-heading text-nex-gray-500 mb-1">Unidade *</label>
                <select required value={form.unidade} onChange={e => setForm(p => ({ ...p, unidade: e.target.value as Unidade, nome_sala: '' }))}
                  className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400">
                  <option value="francisco_rocha">Francisco Rocha (FCO)</option>
                  <option value="nex_house">Nex House (NH)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-heading text-nex-gray-500 mb-1">Data *</label>
                <input required type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
                  className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-heading text-nex-gray-500 mb-1">Horário *</label>
                <input required type="time" value={form.horario} onChange={e => setForm(p => ({ ...p, horario: e.target.value }))}
                  className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-heading text-nex-gray-500 mb-1">Sala *</label>
                <select required value={form.nome_sala} onChange={e => setForm(p => ({ ...p, nome_sala: e.target.value }))}
                  className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400">
                  <option value="">Selecione…</option>
                  {salas.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-heading text-nex-gray-500 mb-1">Nº de Pessoas</label>
                <input type="number" min={1} max={50} value={form.quantidade_pessoas} onChange={e => setForm(p => ({ ...p, quantidade_pessoas: e.target.value }))}
                  placeholder="Ex.: 4"
                  className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-heading text-nex-gray-500 mb-1">Observações</label>
              <textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                rows={2} placeholder="Ex.: cliente trará equipamento próprio, necessita projetor…"
                className="w-full resize-none rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
            </div>

            {sucesso && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                Reserva registrada e e-mail enviado com sucesso!
              </div>
            )}
            {erro && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-nex-black text-white py-2.5 text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? 'Registrando…' : 'Registrar e Enviar E-mail'}
            </button>
          </form>
        </div>

        {/* Email Preview */}
        <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="border-b border-nex-gray-100 px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Prévia do E-mail</span>
            {preview && (
              <span className="text-[11px] text-nex-gray-400">Para: {preview.destinatarios}</span>
            )}
          </div>
          {preview ? (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="rounded-lg border border-nex-gray-100 overflow-hidden text-xs font-mono">
                <div className="bg-nex-gray-800 text-white px-4 py-3">
                  <p className="font-bold text-xs">Nex. <span className="font-normal text-nex-gray-400 ml-2">Registro de Reservas</span></p>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-nex-gray-600 text-[11px] leading-relaxed" dangerouslySetInnerHTML={{ __html: preview.intro }} />
                  <table className="w-full border border-nex-gray-100 rounded text-[11px]">
                    <tbody>
                      {[
                        ['Tipo', preview.tipoLabel],
                        ['Cliente', form.nome_cliente],
                        ['Data', preview.dataFormatada],
                        ['Horário', form.horario],
                        ['Sala', form.nome_sala],
                        ['Pessoas', form.quantidade_pessoas || '—'],
                        ['Unidade', preview.unidadeLabel],
                        ...(form.observacoes ? [['Observações', form.observacoes]] : []),
                      ].map(([k, v], i) => {
                        const isTipo = k === 'Tipo'
                        return (
                          <tr key={k} className={isTipo ? 'bg-nex-yellow/30' : i % 2 === 0 ? 'bg-nex-gray-50' : ''}>
                            <td className={`px-3 py-1.5 font-semibold w-32 ${isTipo ? 'text-nex-black' : 'text-nex-gray-500'}`}>{k}</td>
                            <td className={`px-3 py-1.5 capitalize ${isTipo ? 'text-nex-black font-bold' : 'text-nex-gray-800'}`}>{v}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <p className="text-nex-gray-300 text-[10px]">Registrado por {operador} via Nex Marketing Operações.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <p className="text-sm text-nex-gray-300 text-center">Preencha o formulário ao lado para ver a prévia do e-mail.</p>
            </div>
          )}
        </div>
      </div>

      {/* Dashboard */}
      <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
        <div className="border-b border-nex-gray-100 px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-xs font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Histórico e Métricas</span>
          <div className="flex items-center gap-2 flex-wrap">
            <SlidersHorizontal className="w-3.5 h-3.5 text-nex-gray-400" />
            <input type="date" value={filtro.de} onChange={e => setFiltro(p => ({ ...p, de: e.target.value }))}
              className="rounded-md border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
            <span className="text-xs text-nex-gray-400">até</span>
            <input type="date" value={filtro.ate} onChange={e => setFiltro(p => ({ ...p, ate: e.target.value }))}
              className="rounded-md border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
            <select value={filtro.unidade} onChange={e => setFiltro(p => ({ ...p, unidade: e.target.value }))}
              className="rounded-md border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400">
              <option value="">Todas as unidades</option>
              <option value="francisco_rocha">Francisco Rocha</option>
              <option value="nex_house">Nex House</option>
            </select>
            <select value={filtro.tipo} onChange={e => setFiltro(p => ({ ...p, tipo: e.target.value }))}
              className="rounded-md border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400">
              <option value="">Todos os tipos</option>
              <option value="primeira_vez">Primeira vez</option>
              <option value="quatro_horas">4 horas ou mais</option>
            </select>
            <button onClick={carregar} className="flex items-center gap-1 text-xs text-nex-gray-400 hover:text-nex-black transition-colors">
              <RefreshCw className={cn('w-3 h-3', carregando && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-nex-gray-100 border-b border-nex-gray-100">
          {[
            { label: 'Total no período', value: totalMes, icon: CalendarDays },
            { label: 'Francisco Rocha', value: porUnidade.francisco_rocha, icon: MapPin },
            { label: 'Nex House', value: porUnidade.nex_house, icon: MapPin },
            { label: 'Primeira vez', value: porTipo.primeira_vez, icon: Users },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-white px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5 text-nex-gray-400" />
                <span className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">{label}</span>
              </div>
              <p className="text-2xl font-bold text-nex-black">{value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {carregando ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-nex-gray-300" />
            </div>
          ) : reservas.length === 0 ? (
            <div className="py-10 text-center text-sm text-nex-gray-300">Nenhuma reserva no período selecionado.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nex-gray-100">
                  {['Data', 'Horário', 'Cliente', 'Sala', 'Pessoas', 'Tipo', 'Unidade', 'Observações'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reservas.map((r, i) => (
                  <tr key={r.id} className={cn('border-b border-nex-gray-50 hover:bg-nex-gray-50 transition-colors', i % 2 === 0 ? '' : 'bg-white')}>
                    <td className="px-4 py-2.5 text-nex-gray-800 whitespace-nowrap">
                      {new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-2.5 text-nex-gray-800 whitespace-nowrap flex items-center gap-1">
                      <Clock className="w-3 h-3 text-nex-gray-300" />{r.horario}
                    </td>
                    <td className="px-4 py-2.5 text-nex-gray-800 font-medium">{r.nome_cliente}</td>
                    <td className="px-4 py-2.5 text-nex-gray-600">{r.nome_sala}</td>
                    <td className="px-4 py-2.5 text-nex-gray-600 text-center">{r.quantidade_pessoas ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-heading font-semibold',
                        r.tipo === 'primeira_vez' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700')}>
                        {r.tipo === 'primeira_vez' ? '1ª vez' : '4h+'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-nex-gray-600 whitespace-nowrap">{UNIDADE_LABEL[r.unidade]}</td>
                    <td className="px-4 py-2.5 text-nex-gray-400 max-w-[200px] truncate">{r.observacoes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
