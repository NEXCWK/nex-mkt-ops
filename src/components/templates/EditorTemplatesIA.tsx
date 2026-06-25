'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Sparkles, Send, Loader2, Check, AlertTriangle,
  FileText, RotateCcw, Save, Layers,
} from 'lucide-react'

type TemplateDoc = { tipo: string; nome: string; versao: number }
type Operacao = { buscar: string; substituir: string }
type Resultado = {
  tipo: string
  nome: string
  resposta: string
  aplicadas: Operacao[]
  naoAplicadas: Operacao[]
  camposNovos: Array<Record<string, unknown>>
  versao: number
  salvo: boolean
  erro?: string
}
type ChatMessage =
  | { role: 'user'; content: string; alvos?: number }
  | { role: 'assistant'; resultados: Resultado[]; emLote: boolean }
type Historico = { role: 'user' | 'assistant'; content: string }

/** Deriva o grupo de produto a partir do tipo (snake_case). */
function grupoDoTipo(tipo: string): string {
  if (tipo.startsWith('escritorio_privativo')) return 'Escritório Privativo'
  if (tipo.startsWith('nex_house')) return 'Nex House'
  if (tipo.startsWith('escritorio_virtual')) return 'Escritório Virtual'
  if (tipo.startsWith('aditivo')) return 'Aditivos'
  if (tipo.startsWith('termo')) return 'Termos / Eventos'
  return 'Outros'
}

export function EditorTemplatesIA() {
  const [templates, setTemplates] = useState<TemplateDoc[]>([])
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [historico, setHistorico] = useState<Historico[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/templates/listar')
      .then(r => r.json())
      .then(d => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setCarregandoLista(false))
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Agrupa templates por produto
  const grupos = useMemo(() => {
    const map = new Map<string, TemplateDoc[]>()
    for (const t of templates) {
      const g = grupoDoTipo(t.tipo)
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(t)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [templates])

  const todosSelecionados = templates.length > 0 && selecionados.size === templates.length

  function toggle(tipo: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      next.has(tipo) ? next.delete(tipo) : next.add(tipo)
      return next
    })
    // Mudou o alvo → conversa multi-turn não se aplica mais
    setHistorico([])
  }

  function toggleGrupo(itens: TemplateDoc[]) {
    setSelecionados(prev => {
      const next = new Set(prev)
      const todosNoGrupo = itens.every(t => next.has(t.tipo))
      itens.forEach(t => todosNoGrupo ? next.delete(t.tipo) : next.add(t.tipo))
      return next
    })
    setHistorico([])
  }

  function toggleTodos() {
    setSelecionados(todosSelecionados ? new Set() : new Set(templates.map(t => t.tipo)))
    setHistorico([])
  }

  async function enviar() {
    const msg = input.trim()
    if (!msg || selecionados.size === 0 || loading) return
    const tipos = [...selecionados]
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg, alvos: tipos.length }])
    setLoading(true)
    try {
      const res = await fetch('/api/templates/editar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipos, mensagem: msg, historico: tipos.length === 1 ? historico : [] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`)
      const resultados: Resultado[] = data.resultados ?? []
      setHistorico(data.historico ?? [])
      setMessages(prev => [...prev, { role: 'assistant', resultados, emLote: !!data.emLote }])
      // Atualiza versões na lista
      setTemplates(prev => prev.map(t => {
        const r = resultados.find(x => x.tipo === t.tipo && x.salvo)
        return r ? { ...t, versao: r.versao } : t
      }))
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        emLote: false,
        resultados: [{ tipo: '', nome: '', resposta: '', aplicadas: [], naoAplicadas: [], camposNovos: [], versao: 0, salvo: false, erro: e instanceof Error ? e.message : 'erro desconhecido' }],
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-nex-gray-100 pt-5 mt-5">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-nex-gray-400" />
        <p className="text-sm font-heading font-semibold text-nex-black">Editar templates existentes com IA</p>
      </div>
      <p className="text-xs text-nex-gray-500 mb-4">
        Marque um, vários, um grupo de produto inteiro ou todos os contratos já cadastrados e peça a alteração
        em linguagem natural. A IA edita os arquivos <strong>diretamente no sistema</strong> (Storage),
        preservando layout, fontes e marcadores <code className="bg-nex-gray-100 px-1 rounded">{'{{token}}'}</code>,
        e salva uma nova versão de cada um.
      </p>

      {carregandoLista ? (
        <div className="flex items-center gap-2 text-sm text-nex-gray-400 py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando templates…
        </div>
      ) : templates.length === 0 ? (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Nenhum template cadastrado ainda. Use o parametrizador acima para importar um contrato primeiro.
          </p>
        </div>
      ) : (
        <>
          {/* Seleção de alvos */}
          <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-nex-gray-100 bg-nex-gray-50">
              <p className="text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Quais templates editar
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-nex-gray-400">{selecionados.size} selecionado(s)</span>
                <button onClick={toggleTodos} className="text-xs font-semibold text-nex-black hover:underline">
                  {todosSelecionados ? 'Limpar todos' : 'Selecionar todos'}
                </button>
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto divide-y divide-nex-gray-100">
              {grupos.map(([grupo, itens]) => {
                const grupoMarcado = itens.every(t => selecionados.has(t.tipo))
                return (
                  <div key={grupo}>
                    <button
                      onClick={() => toggleGrupo(itens)}
                      className="w-full flex items-center gap-2 px-4 py-2 bg-nex-gray-50/50 hover:bg-nex-gray-100 transition-colors text-left"
                    >
                      <span className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                        grupoMarcado ? 'bg-nex-black border-nex-black' : 'border-nex-gray-300')}>
                        {grupoMarcado && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      <span className="text-xs font-heading font-semibold text-nex-gray-600">{grupo}</span>
                      <span className="text-[11px] text-nex-gray-400">({itens.length})</span>
                    </button>
                    {itens.map(t => (
                      <button
                        key={t.tipo}
                        onClick={() => toggle(t.tipo)}
                        className="w-full flex items-center gap-2 pl-9 pr-4 py-1.5 hover:bg-nex-gray-50 transition-colors text-left"
                      >
                        <span className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                          selecionados.has(t.tipo) ? 'bg-nex-black border-nex-black' : 'border-nex-gray-300')}>
                          {selecionados.has(t.tipo) && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                        <span className="text-xs text-nex-gray-700 flex-1">{t.nome}</span>
                        <span className="text-[11px] text-nex-gray-400">v{t.versao}</span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Chat */}
          <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden flex flex-col">
            {messages.length > 0 && (
              <div className="flex items-center justify-end px-3 py-2 border-b border-nex-gray-100">
                <button onClick={() => { setMessages([]); setHistorico([]) }} className="flex items-center gap-1.5 text-xs text-nex-gray-400 hover:text-nex-black transition-colors">
                  <RotateCcw className="w-3.5 h-3.5" /> Limpar conversa
                </button>
              </div>
            )}
            <div className="max-h-[460px] overflow-y-auto px-4 py-4 space-y-3 min-h-[120px]">
              {messages.length === 0 ? (
                <p className="text-sm text-nex-gray-400 text-center py-8">
                  Selecione os templates acima e descreva a alteração. Ex.: &quot;troque a vigência de 12 para 24 meses&quot;,
                  &quot;adicione cláusula de multa por atraso&quot;, &quot;atualize o telefone da unidade para (41) 3122-8801&quot;.
                </p>
              ) : (
                messages.map((m, i) => m.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-xl px-4 py-2.5 bg-nex-black text-white">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      {m.alvos && m.alvos > 1 && (
                        <p className="text-[11px] text-nex-gray-300 mt-1">aplicar a {m.alvos} templates</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[92%] w-full space-y-2">
                      {m.resultados.map((r, j) => (
                        <div key={j} className={cn('rounded-xl px-4 py-2.5 border',
                          r.erro ? 'bg-red-50 border-red-200' : 'bg-nex-gray-50 border-nex-gray-100')}>
                          {m.emLote && (r.nome || r.tipo) && (
                            <p className="text-[11px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400 mb-1 flex items-center gap-1.5">
                              <FileText className="w-3 h-3" /> {r.nome || r.tipo}
                            </p>
                          )}
                          {r.erro ? (
                            <p className="text-sm text-red-700 flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {r.erro}
                            </p>
                          ) : (
                            <>
                              <p className="text-sm text-nex-gray-800 whitespace-pre-wrap leading-relaxed">{r.resposta}</p>
                              {r.salvo && (
                                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-green-600 font-semibold">
                                  <Save className="w-3 h-3" /> Salvo · v{r.versao} · {r.aplicadas.length} alteração(ões)
                                </div>
                              )}
                              {r.naoAplicadas.length > 0 && (
                                <div className="mt-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                                  <p className="text-[11px] text-amber-800">
                                    {r.naoAplicadas.length} trecho(s) não localizado(s) — texto fragmentado no Word. Tente um trecho menor.
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-nex-gray-50 border border-nex-gray-100 rounded-xl px-4 py-2.5 flex items-center gap-2 text-nex-gray-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-sm">{selecionados.size > 1 ? `Editando ${selecionados.size} documentos…` : 'Editando o documento…'}</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-nex-gray-100 p-3 flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                placeholder={selecionados.size === 0 ? 'Selecione ao menos um template acima…' : 'Descreva a alteração a aplicar…'}
                disabled={loading || selecionados.size === 0}
                className="flex-1 rounded-lg border border-nex-gray-200 bg-white px-3 py-2.5 text-sm placeholder:text-nex-gray-300 focus:outline-none focus:ring-1 focus:ring-nex-gray-400 transition-colors disabled:opacity-50"
              />
              <Button onClick={enviar} disabled={loading || !input.trim() || selecionados.size === 0} className="gap-1.5 flex-shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Aplicar
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
