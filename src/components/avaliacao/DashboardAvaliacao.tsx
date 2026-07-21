'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { BarChart3, Loader2, RefreshCw, CalendarDays, AlertTriangle, MessageSquareQuote, X, Eraser } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line,
} from 'recharts'
import { WordCloud } from './WordCloud'

interface PontoAtencao { tipo: 'objecao' | 'atrito' | 'ponto_forte'; texto: string; trecho: string }
interface Kpi { nome: string; nota: number; comentario: string }

interface ConversaRow {
  id: string
  atendente: string
  data: string | null
  nota: number
  resumo: string
  kpis: Kpi[]
  pontos_atencao: PontoAtencao[]
  palavras_chave: string[]
  trecho: string
  created_at: string
}

function notaColor(n: number): string {
  if (n >= 8) return 'text-green-600'
  if (n >= 6) return 'text-yellow-600'
  if (n >= 4) return 'text-orange-600'
  return 'text-red-600'
}

export function DashboardAvaliacao({ tipo }: { tipo: 'atendimento' | 'telefonema' }) {
  const [conversas, setConversas] = useState<ConversaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [atendenteFiltro, setAtendenteFiltro] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [modalTrecho, setModalTrecho] = useState<{ titulo: string; texto: string } | null>(null)
  const [limpando, setLimpando] = useState(false)
  const [msgLimpeza, setMsgLimpeza] = useState<string | null>(null)

  const carregar = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tipo })
      if (atendenteFiltro) params.set('atendente', atendenteFiltro)
      if (de) params.set('de', de)
      if (ate) params.set('ate', ate)
      const res = await fetch(`/api/avaliacao/dashboard?${params}`)
      const json = await res.json()
      setConversas(json.conversas ?? [])
    } catch {
      setConversas([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [tipo, atendenteFiltro, de, ate]) // eslint-disable-line react-hooks/exhaustive-deps

  async function limparUltimoLoteSemInteracao() {
    if (limpando) return
    setLimpando(true)
    setMsgLimpeza(null)
    try {
      const res = await fetch('/api/avaliacao/limpar-sem-interacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setMsgLimpeza(
        json.removidas > 0
          ? `${json.removidas} conversa(s) sem interação real removida(s) do último lote enviado.`
          : 'Nenhuma conversa sem interação real encontrada no último lote enviado.'
      )
      carregar()
    } catch (e) {
      setMsgLimpeza(e instanceof Error ? e.message : 'Falha ao limpar o lote')
    } finally {
      setLimpando(false)
    }
  }

  const atendentes = useMemo(
    () => Array.from(new Set(conversas.map(c => c.atendente))).sort(),
    [conversas]
  )

  const totalConversas = conversas.length
  const notaMediaGeral = totalConversas > 0
    ? conversas.reduce((s, c) => s + (c.nota || 0), 0) / totalConversas
    : 0

  const porAtendente = useMemo(() => {
    const grupos = new Map<string, { soma: number; qtd: number }>()
    for (const c of conversas) {
      const g = grupos.get(c.atendente) ?? { soma: 0, qtd: 0 }
      g.soma += c.nota || 0
      g.qtd += 1
      grupos.set(c.atendente, g)
    }
    return Array.from(grupos.entries())
      .map(([atendente, g]) => ({ atendente, notaMedia: Number((g.soma / g.qtd).toFixed(1)), conversas: g.qtd }))
      .sort((a, b) => b.conversas - a.conversas)
  }, [conversas])

  const evolucao = useMemo(() => {
    const grupos = new Map<string, { soma: number; qtd: number }>()
    for (const c of conversas) {
      const key = c.data ?? c.created_at?.slice(0, 10) ?? 'sem data'
      const g = grupos.get(key) ?? { soma: 0, qtd: 0 }
      g.soma += c.nota || 0
      g.qtd += 1
      grupos.set(key, g)
    }
    return Array.from(grupos.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, g]) => ({ data, notaMedia: Number((g.soma / g.qtd).toFixed(1)) }))
  }, [conversas])

  const nuvemPalavras = useMemo(() => {
    const freq: Record<string, number> = {}
    for (const c of conversas) {
      for (const p of c.palavras_chave ?? []) {
        const chave = p.toLowerCase().trim()
        if (!chave) continue
        freq[chave] = (freq[chave] ?? 0) + 1
      }
    }
    return freq
  }, [conversas])

  const pontosAtencao = useMemo(() => {
    const lista: { atendente: string; ponto: PontoAtencao }[] = []
    for (const c of conversas) {
      for (const p of c.pontos_atencao ?? []) {
        if (p.tipo === 'objecao' || p.tipo === 'atrito') {
          lista.push({ atendente: c.atendente, ponto: p })
        }
      }
    }
    return lista
  }, [conversas])

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap bg-white border border-nex-gray-200 rounded-xl px-4 py-3">
        <CalendarDays className="w-3.5 h-3.5 text-nex-gray-400" />
        <input type="date" value={de} onChange={e => setDe(e.target.value)}
          className="rounded-md border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
        <span className="text-xs text-nex-gray-400">até</span>
        <input type="date" value={ate} onChange={e => setAte(e.target.value)}
          className="rounded-md border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
        <select value={atendenteFiltro} onChange={e => setAtendenteFiltro(e.target.value)}
          className="rounded-md border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400">
          <option value="">Todos os atendentes (visão geral)</option>
          {atendentes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={limparUltimoLoteSemInteracao} disabled={limpando}
          className="flex items-center gap-1 text-xs text-nex-gray-400 hover:text-nex-black transition-colors ml-auto disabled:opacity-40">
          {limpando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eraser className="w-3 h-3" />}
          Limpar sem interação (último lote)
        </button>
        <button onClick={carregar} className="flex items-center gap-1 text-xs text-nex-gray-400 hover:text-nex-black transition-colors">
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} /> Atualizar
        </button>
      </div>

      {msgLimpeza && (
        <p className="text-xs text-nex-gray-500 bg-nex-gray-50 border border-nex-gray-100 rounded-lg px-3 py-2">{msgLimpeza}</p>
      )}

      {loading && conversas.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-nex-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando dados…
        </div>
      ) : totalConversas === 0 ? (
        <div className="py-16 text-center text-sm text-nex-gray-300">
          Nenhuma avaliação encontrada. Envie transcrições na aba &quot;Enviar Transcrições&quot;.
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-nex-gray-200 rounded-xl px-5 py-4">
              <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Conversas</p>
              <p className="text-3xl font-bold text-nex-black">{totalConversas}</p>
            </div>
            <div className="bg-white border border-nex-gray-200 rounded-xl px-5 py-4">
              <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Nota Média</p>
              <p className={cn('text-3xl font-bold', notaColor(notaMediaGeral))}>{notaMediaGeral.toFixed(1)}</p>
            </div>
            <div className="bg-white border border-nex-gray-200 rounded-xl px-5 py-4">
              <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Atendentes</p>
              <p className="text-3xl font-bold text-nex-black">{atendentes.length}</p>
            </div>
            <div className="bg-white border border-nex-gray-200 rounded-xl px-5 py-4">
              <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Objeções / Atritos</p>
              <p className="text-3xl font-bold text-orange-600">{pontosAtencao.length}</p>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white border border-nex-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-heading font-semibold text-nex-black mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-nex-gray-400" /> Nota média por atendente
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={porAtendente}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="atendente" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="notaMedia" fill="#0a0a0a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border border-nex-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-heading font-semibold text-nex-black mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-nex-gray-400" /> Evolução da nota média
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={evolucao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="notaMedia" stroke="#FFD400" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Nuvem de palavras */}
          <div className="bg-white border border-nex-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-heading font-semibold text-nex-black mb-2">Principais palavras utilizadas</h3>
            <WordCloud palavras={nuvemPalavras} />
          </div>

          {/* Objeções e pontos de atrito */}
          <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
            <div className="border-b border-nex-gray-100 px-5 py-3">
              <h3 className="text-sm font-heading font-semibold text-nex-black flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-orange-500" /> Principais objeções e pontos de atrito
              </h3>
            </div>
            <div className="divide-y divide-nex-gray-50 max-h-96 overflow-y-auto">
              {pontosAtencao.length === 0 ? (
                <p className="text-sm text-nex-gray-300 text-center py-8">Nenhuma objeção ou ponto de atrito identificado no período.</p>
              ) : (
                pontosAtencao.map((item, i) => (
                  <button key={i} onClick={() => setModalTrecho({ titulo: `${item.atendente} · ${item.ponto.tipo === 'objecao' ? 'Objeção' : 'Ponto de atrito'}`, texto: item.ponto.trecho })}
                    className="w-full text-left px-5 py-3 hover:bg-nex-gray-50 transition-colors flex items-start gap-3">
                    <span className={cn('mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-heading font-semibold whitespace-nowrap',
                      item.ponto.tipo === 'objecao' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600')}>
                      {item.ponto.tipo === 'objecao' ? 'Objeção' : 'Atrito'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-nex-gray-800">{item.ponto.texto}</p>
                      <p className="text-xs text-nex-gray-400 mt-0.5">{item.atendente} · clique para ver o trecho</p>
                    </div>
                    <MessageSquareQuote className="w-3.5 h-3.5 text-nex-gray-300 flex-shrink-0 mt-1" />
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal de trecho */}
      {modalTrecho && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setModalTrecho(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-heading font-semibold text-nex-black">{modalTrecho.titulo}</h4>
              <button onClick={() => setModalTrecho(null)} className="text-nex-gray-400 hover:text-nex-black">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-nex-gray-700 whitespace-pre-wrap leading-relaxed bg-nex-gray-50 border border-nex-gray-100 rounded-lg p-3">
              &ldquo;{modalTrecho.texto}&rdquo;
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
