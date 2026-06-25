'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Sparkles, Send, Loader2, ChevronDown, Check, AlertTriangle,
  FileText, RotateCcw, Save,
} from 'lucide-react'

type TemplateDoc = { tipo: string; nome: string; versao: number }
type Operacao = { buscar: string; substituir: string }
type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  aplicadas?: Operacao[]
  naoAplicadas?: Operacao[]
  salvo?: boolean
  versao?: number
}
type Historico = { role: 'user' | 'assistant'; content: string }

export function EditorTemplatesIA() {
  const [templates, setTemplates] = useState<TemplateDoc[]>([])
  const [carregandoLista, setCarregandoLista] = useState(true)
  const [tipo, setTipo] = useState('')
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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const templateAtual = templates.find(t => t.tipo === tipo)

  function trocarTemplate(novoTipo: string) {
    setTipo(novoTipo)
    setMessages([])
    setHistorico([])
    setInput('')
  }

  async function enviar() {
    const msg = input.trim()
    if (!msg || !tipo || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const res = await fetch('/api/templates/editar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, historico, mensagem: msg }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`)
      setHistorico(data.historico ?? [])
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.resposta ?? 'Pronto.',
        aplicadas: data.aplicadas ?? [],
        naoAplicadas: data.naoAplicadas ?? [],
        salvo: data.salvo,
        versao: data.versao,
      }])
      if (data.salvo) {
        setTemplates(prev => prev.map(t => t.tipo === tipo ? { ...t, versao: data.versao } : t))
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Não consegui aplicar: ${e instanceof Error ? e.message : 'erro desconhecido'}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-nex-gray-100 pt-5 mt-5">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-nex-gray-400" />
        <p className="text-sm font-heading font-semibold text-nex-black">Editar template existente com IA</p>
      </div>
      <p className="text-xs text-nex-gray-500 mb-4">
        Selecione um contrato já cadastrado e peça alterações em linguagem natural. A IA edita o
        arquivo <strong>diretamente no sistema</strong> (Storage), preservando layout, fontes e marcadores
        {' '}<code className="bg-nex-gray-100 px-1 rounded">{'{{token}}'}</code>, e salva uma nova versão.
      </p>

      {/* Seletor de template */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <select
            value={tipo}
            onChange={e => trocarTemplate(e.target.value)}
            disabled={carregandoLista}
            className="w-full h-9 rounded-md border border-nex-gray-200 bg-white px-3 pr-8 text-sm text-nex-black focus:outline-none focus:ring-1 focus:ring-nex-gray-400 appearance-none disabled:opacity-50"
          >
            <option value="">
              {carregandoLista ? 'Carregando templates…' : 'Selecione um template para editar…'}
            </option>
            {templates.map(t => (
              <option key={t.tipo} value={t.tipo}>{t.nome} (v{t.versao})</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-nex-gray-400 pointer-events-none" />
        </div>
        {templateAtual && (
          <span className="text-xs text-nex-gray-400 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> versão atual: v{templateAtual.versao}
          </span>
        )}
        {messages.length > 0 && (
          <button onClick={() => { setMessages([]); setHistorico([]) }} className="flex items-center gap-1.5 text-xs text-nex-gray-400 hover:text-nex-black transition-colors ml-auto">
            <RotateCcw className="w-3.5 h-3.5" /> Limpar conversa
          </button>
        )}
      </div>

      {!carregandoLista && templates.length === 0 && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Nenhum template cadastrado ainda. Use o parametrizador acima para importar um contrato primeiro.
          </p>
        </div>
      )}

      {/* Chat */}
      {tipo && (
        <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden flex flex-col">
          <div className="max-h-[420px] overflow-y-auto px-4 py-4 space-y-3 min-h-[120px]">
            {messages.length === 0 ? (
              <p className="text-sm text-nex-gray-400 text-center py-8">
                Ex.: &quot;troque o prazo de vigência de 12 para 24 meses&quot;, &quot;adicione uma cláusula de
                multa por atraso&quot;, &quot;parametrize o nome do fiador&quot;.
              </p>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-xl px-4 py-2.5',
                    m.role === 'user' ? 'bg-nex-black text-white' : 'bg-nex-gray-50 border border-nex-gray-100 text-nex-gray-800'
                  )}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>

                    {m.role === 'assistant' && m.salvo && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green-600 font-semibold">
                        <Save className="w-3 h-3" /> Salvo no sistema · v{m.versao} · {m.aplicadas?.length} alteração(ões) aplicada(s)
                      </div>
                    )}

                    {m.role === 'assistant' && m.aplicadas && m.aplicadas.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {m.aplicadas.map((op, j) => (
                          <li key={j} className="text-[11px] text-nex-gray-500 flex items-start gap-1.5">
                            <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="font-mono">
                              &quot;{op.buscar.slice(0, 40)}{op.buscar.length > 40 ? '…' : ''}&quot; → &quot;{op.substituir.slice(0, 40)}{op.substituir.length > 40 ? '…' : ''}&quot;
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {m.role === 'assistant' && m.naoAplicadas && m.naoAplicadas.length > 0 && (
                      <div className="mt-2 px-2.5 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {m.naoAplicadas.length} trecho(s) não localizado(s) no documento
                        </p>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          O texto pode estar fragmentado no Word. Peça para tentar um trecho menor ou mais específico.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-nex-gray-50 border border-nex-gray-100 rounded-xl px-4 py-2.5 flex items-center gap-2 text-nex-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-sm">Editando o documento…</span>
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
              placeholder="Descreva a alteração que a IA deve aplicar neste contrato…"
              disabled={loading}
              className="flex-1 rounded-lg border border-nex-gray-200 bg-white px-3 py-2.5 text-sm placeholder:text-nex-gray-300 focus:outline-none focus:ring-1 focus:ring-nex-gray-400 transition-colors disabled:opacity-50"
            />
            <Button onClick={enviar} disabled={loading || !input.trim()} className="gap-1.5 flex-shrink-0">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Aplicar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
