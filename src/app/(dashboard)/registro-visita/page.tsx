'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { Send, Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

interface Visita {
  id: string
  nome_lead: string
  data: string
  hora: string
  produto_interesse: string
  compareceu: boolean
  operador_email: string
  created_at: string
}

const PRODUTOS = [
  'Escritório Virtual',
  'Mesa Fixa',
  'Escritório Privativo',
  'Nex House — Atrium',
  'Nex House — Gallery',
  'Sala de Reunião',
  'Todos os produtos',
]

function hoje() {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_FORM = {
  nome_lead: '',
  data: hoje(),
  hora: '',
  produto_interesse: '',
}

export default function RegistroVisitaPage() {
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [carregando, setCarregando] = useState(false)
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const res = await fetch('/api/registro-visitas')
    const json = await res.json()
    setVisitas(json.visitas ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome_lead || !form.data || !form.hora || !form.produto_interesse) return
    setLoading(true)
    setErro(null)
    setSucesso(false)
    try {
      const res = await fetch('/api/registro-visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setSucesso(true)
      setForm({ ...EMPTY_FORM })
      carregar()
      setTimeout(() => setSucesso(false), 4000)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar')
    } finally {
      setLoading(false)
    }
  }

  async function toggleCompareceu(visita: Visita) {
    setToggleLoading(visita.id)
    try {
      const res = await fetch('/api/registro-visitas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: visita.id, compareceu: !visita.compareceu }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar')
      setVisitas(prev => prev.map(v => v.id === visita.id ? { ...v, compareceu: !v.compareceu } : v))
    } catch {
      // silent
    } finally {
      setToggleLoading(null)
    }
  }

  const totalVisitas = visitas.length
  const shows = visitas.filter(v => v.compareceu).length
  const noShows = visitas.filter(v => !v.compareceu).length
  const taxaShow = totalVisitas > 0 ? Math.round((shows / totalVisitas) * 100) : 0

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <PageHeader
        title="Registro de Visita"
        description="Registre visitas de leads ao espaço e acompanhe Show / No-Show."
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
        {/* Form */}
        <div className="bg-white border border-nex-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-heading font-semibold text-nex-black mb-4">Nova Visita</h2>
          <form onSubmit={registrar} className="space-y-3">
            <div>
              <label className="block text-xs font-heading text-nex-gray-500 mb-1">Nome do Lead *</label>
              <input required value={form.nome_lead} onChange={e => setForm(p => ({ ...p, nome_lead: e.target.value }))}
                placeholder="Ex.: Maria Oliveira"
                className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400 focus:border-nex-gray-400" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-heading text-nex-gray-500 mb-1">Data *</label>
                <input required type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
                  className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-heading text-nex-gray-500 mb-1">Hora *</label>
                <input required type="time" value={form.hora} onChange={e => setForm(p => ({ ...p, hora: e.target.value }))}
                  className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-heading text-nex-gray-500 mb-1">Produto de Interesse *</label>
              <select required value={form.produto_interesse} onChange={e => setForm(p => ({ ...p, produto_interesse: e.target.value }))}
                className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400">
                <option value="">Selecione…</option>
                {PRODUTOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {sucesso && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                Visita registrada e e-mail enviado!
              </div>
            )}
            {erro && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-nex-black text-white py-2.5 text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? 'Registrando…' : 'Registrar Visita'}
            </button>
            <p className="text-[11px] text-nex-gray-300 text-center">
              E-mail automático para felipe@nex.work e lenise@nex.work
            </p>
          </form>
        </div>

        {/* Stats */}
        <div className="xl:col-span-2 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-2 gap-4 content-start">
          {[
            { label: 'Total de Visitas', value: totalVisitas, color: 'text-nex-black' },
            { label: 'Taxa de Show', value: `${taxaShow}%`, color: 'text-green-600' },
            { label: 'Shows', value: shows, color: 'text-green-600' },
            { label: 'No-Shows', value: noShows, color: 'text-red-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-nex-gray-200 rounded-xl px-5 py-4">
              <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">{label}</p>
              <p className={cn('text-3xl font-bold', color)}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
        <div className="border-b border-nex-gray-100 px-5 py-3 flex items-center justify-between">
          <span className="text-xs font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Visitas Registradas</span>
          <button onClick={carregar} className="flex items-center gap-1 text-xs text-nex-gray-400 hover:text-nex-black transition-colors">
            <RefreshCw className={cn('w-3 h-3', carregando && 'animate-spin')} /> Atualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          {carregando ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-nex-gray-300" />
            </div>
          ) : visitas.length === 0 ? (
            <div className="py-10 text-center text-sm text-nex-gray-300">Nenhuma visita registrada ainda.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nex-gray-100">
                  {['Data', 'Hora', 'Lead', 'Produto de Interesse', 'Registrado por', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visitas.map((v, i) => (
                  <tr key={v.id} className={cn('border-b border-nex-gray-50 hover:bg-nex-gray-50 transition-colors', i % 2 === 0 ? '' : 'bg-white')}>
                    <td className="px-4 py-2.5 text-nex-gray-800 whitespace-nowrap">
                      {new Date(v.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-2.5 text-nex-gray-800 whitespace-nowrap">{v.hora}</td>
                    <td className="px-4 py-2.5 text-nex-gray-800 font-medium">{v.nome_lead}</td>
                    <td className="px-4 py-2.5 text-nex-gray-600">{v.produto_interesse}</td>
                    <td className="px-4 py-2.5 text-nex-gray-400 text-xs">{v.operador_email}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => toggleCompareceu(v)}
                        disabled={toggleLoading === v.id}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-heading font-semibold border transition-colors',
                          v.compareceu
                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                            : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100',
                          toggleLoading === v.id && 'opacity-50 pointer-events-none'
                        )}
                        title="Clique para alternar Show / No-Show"
                      >
                        {toggleLoading === v.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : v.compareceu
                            ? <CheckCircle2 className="w-3 h-3" />
                            : <XCircle className="w-3 h-3" />}
                        {v.compareceu ? 'Show' : 'No-Show'}
                      </button>
                    </td>
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
