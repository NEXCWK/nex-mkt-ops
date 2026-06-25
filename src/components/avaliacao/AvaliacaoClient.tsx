'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { Sparkles, BarChart3, ThumbsUp, AlertTriangle, RotateCcw, PencilLine } from 'lucide-react'

export interface Kpi {
  nome: string
  nota: number
  comentario: string
}

export interface Avaliacao {
  totalAtendimentos: number
  notaGeral: number
  resumoDiario: string
  kpis: Kpi[]
  pontosFortes: string[]
  pontosMelhoria: string[]
  destaques?: { atendente?: string; observacao: string }[]
}

function notaColor(n: number): string {
  if (n >= 8) return 'bg-green-500'
  if (n >= 6) return 'bg-nex-yellow'
  if (n >= 4) return 'bg-orange-400'
  return 'bg-red-500'
}

function notaText(n: number): string {
  if (n >= 8) return 'text-green-600'
  if (n >= 6) return 'text-yellow-600'
  if (n >= 4) return 'text-orange-600'
  return 'text-red-600'
}

function ScoreGauge({ nota }: { nota: number }) {
  const pct = Math.max(0, Math.min(10, nota)) / 10
  const r = 42
  const c = 2 * Math.PI * r
  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#F1F1F1" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none" strokeWidth="8" strokeLinecap="round"
          stroke={nota >= 8 ? '#22c55e' : nota >= 6 ? '#FFD400' : nota >= 4 ? '#fb923c' : '#ef4444'}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn('text-2xl font-heading font-semibold', notaText(nota))}>{nota.toFixed(1)}</span>
        <span className="text-[10px] text-nex-gray-400">/ 10</span>
      </div>
    </div>
  )
}

function KpiBar({ kpi }: { kpi: Kpi }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-heading font-medium text-nex-gray-800">{kpi.nome}</span>
        <span className={cn('text-sm font-heading font-semibold', notaText(kpi.nota))}>{kpi.nota.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full bg-nex-gray-100 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', notaColor(kpi.nota))} style={{ width: `${Math.max(0, Math.min(10, kpi.nota)) * 10}%` }} />
      </div>
      {kpi.comentario && <p className="text-xs text-nex-gray-400 mt-1">{kpi.comentario}</p>}
    </div>
  )
}

interface Props {
  tipo: 'atendimento' | 'telefonema'
  titulo: string
  descricao: string
  placeholder: string
}

export function AvaliacaoClient({ tipo, titulo, descricao, placeholder }: Props) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [data, setData] = useState(hoje)
  const [transcricoes, setTranscricoes] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Avaliacao | null>(null)

  async function avaliar() {
    if (!transcricoes.trim() || loading) return
    setLoading(true)
    setErro(null)
    setResultado(null)
    try {
      const res = await fetch('/api/avaliacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, data, transcricoes }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setResultado(json as Avaliacao)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao avaliar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={titulo}
        description={descricao}
        actions={
          resultado ? (
            <div className="flex items-center gap-3">
              <button onClick={() => setResultado(null)} className="flex items-center gap-1.5 text-xs text-nex-gray-400 hover:text-nex-black transition-colors">
                <PencilLine className="w-3.5 h-3.5" /> Editar
              </button>
              <button onClick={() => { setResultado(null); setTranscricoes(''); setData(new Date().toISOString().slice(0, 10)) }} className="flex items-center gap-1.5 text-xs text-nex-gray-400 hover:text-nex-black transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Nova avaliação
              </button>
            </div>
          ) : undefined
        }
      />

      {!resultado && (
        <div className="bg-white border border-nex-gray-200 rounded-xl p-5 space-y-4 max-w-3xl">
          <div className="flex items-center gap-3">
            <label className="text-sm font-heading font-medium text-nex-gray-700">Data da análise</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              className="rounded-lg border border-nex-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          </div>
          <div>
            <label className="text-sm font-heading font-medium text-nex-gray-700 block mb-1.5">
              Transcrições do dia
            </label>
            <textarea
              value={transcricoes}
              onChange={e => setTranscricoes(e.target.value)}
              rows={14}
              placeholder={placeholder}
              className="w-full resize-y rounded-lg border border-nex-gray-200 bg-white px-3 py-2.5 text-sm placeholder:text-nex-gray-300 focus:outline-none focus:ring-1 focus:ring-nex-gray-400 transition-colors font-mono"
            />
            <p className="text-[11px] text-nex-gray-300 mt-1">
              Cole todas as transcrições do dia, separando cada atendimento (ex.: linha com “---” entre eles).
            </p>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button
            onClick={avaliar}
            disabled={!transcricoes.trim() || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? 'Analisando com IA…' : 'Gerar avaliação diária'}
          </button>
        </div>
      )}

      {resultado && (
        <div className="space-y-5">
          {/* Topo: gauge + resumo */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="bg-white border border-nex-gray-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2">
              <ScoreGauge nota={resultado.notaGeral} />
              <p className="text-sm font-heading font-medium text-nex-gray-700">Nota geral do dia</p>
              <p className="text-xs text-nex-gray-400">{resultado.totalAtendimentos} atendimento(s) avaliado(s) · {data}</p>
            </div>
            <div className="lg:col-span-2 bg-white border border-nex-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-heading font-semibold text-nex-black mb-2 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-nex-gray-400" /> Análise do dia
              </h3>
              <p className="text-sm text-nex-gray-600 whitespace-pre-wrap leading-relaxed">{resultado.resumoDiario}</p>
            </div>
          </div>

          {/* KPIs */}
          <div className="bg-white border border-nex-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-heading font-semibold text-nex-black mb-4">KPIs de atendimento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {resultado.kpis.map(k => <KpiBar key={k.nome} kpi={k} />)}
            </div>
          </div>

          {/* Pontos fortes / melhoria */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white border border-nex-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-heading font-semibold text-nex-black mb-3 flex items-center gap-1.5">
                <ThumbsUp className="w-4 h-4 text-green-500" /> Pontos fortes
              </h3>
              <ul className="space-y-1.5">
                {resultado.pontosFortes.map((p, i) => (
                  <li key={i} className="text-sm text-nex-gray-600 flex gap-2"><span className="text-green-500">•</span>{p}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white border border-nex-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-heading font-semibold text-nex-black mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-orange-500" /> Pontos de melhoria
              </h3>
              <ul className="space-y-1.5">
                {resultado.pontosMelhoria.map((p, i) => (
                  <li key={i} className="text-sm text-nex-gray-600 flex gap-2"><span className="text-orange-500">•</span>{p}</li>
                ))}
              </ul>
            </div>
          </div>

          {resultado.destaques && resultado.destaques.length > 0 && (
            <div className="bg-white border border-nex-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-heading font-semibold text-nex-black mb-3">Destaques por atendimento</h3>
              <div className="space-y-2">
                {resultado.destaques.map((d, i) => (
                  <div key={i} className="text-sm text-nex-gray-600">
                    {d.atendente && <span className="font-heading font-medium text-nex-gray-800">{d.atendente}: </span>}
                    {d.observacao}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
