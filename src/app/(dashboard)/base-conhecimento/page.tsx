'use client'

import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SDR_KB_SEED } from '@/lib/sdr-kb-seed'
import { cn } from '@/lib/utils'
import { Send, Download, RotateCcw, Loader2, BookOpen } from 'lucide-react'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const STORAGE_KEY = 'sdr-kb-md'

export default function BaseConhecimentoPage() {
  const [markdown, setMarkdown] = useState(SDR_KB_SEED)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (saved) setMarkdown(saved)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function persistir(md: string) {
    setMarkdown(md)
    try { localStorage.setItem(STORAGE_KEY, md) } catch { /* ignore */ }
  }

  async function enviar() {
    const content = input.trim()
    if (!content || loading) return
    const novas: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(novas)
    setInput('')
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/base-conhecimento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown, instrucao: content, historico: messages }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setMessages([...novas, { role: 'assistant', content: json.resposta ?? 'Pronto.' }])
      if (json.markdown) persistir(json.markdown)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao editar a base')
      setMessages([...novas, { role: 'assistant', content: 'Não consegui aplicar a alteração. Tente reformular.' }])
    } finally {
      setLoading(false)
    }
  }

  function baixar() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'base-conhecimento-sdr.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  function resetar() {
    persistir(SDR_KB_SEED)
    setMessages([])
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <PageHeader
        title="Base de Conhecimento — Assistente SDR IA"
        description="Edite a base de conhecimento do SDR via chat e baixe o arquivo .md atualizado."
        actions={
          <div className="flex items-center gap-3">
            <button onClick={resetar} className="flex items-center gap-1.5 text-xs text-nex-gray-400 hover:text-nex-black transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrão
            </button>
            <button onClick={baixar} className="flex items-center gap-1.5 text-xs text-nex-gray-500 hover:text-nex-black transition-colors">
              <Download className="w-3.5 h-3.5" /> Baixar .md
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-0">
        {/* Chat */}
        <div className="flex flex-col bg-white border border-nex-gray-200 rounded-xl overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
                <div className="w-10 h-10 rounded-full bg-nex-gray-50 border border-nex-gray-200 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-nex-gray-400" />
                </div>
                <p className="text-sm text-nex-gray-400 max-w-xs">
                  Peça alterações na base — ex.: “adicione o preço do escritório virtual” ou “reescreva as objeções”.
                  O arquivo é atualizado ao lado e fica disponível para download.
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed',
                    m.role === 'user' ? 'bg-nex-black text-white' : 'bg-nex-gray-50 border border-nex-gray-100 text-nex-gray-800')}>
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start"><div className="rounded-xl px-3.5 py-2.5 bg-nex-gray-50 border border-nex-gray-100">
                <Loader2 className="w-4 h-4 animate-spin text-nex-gray-400" />
              </div></div>
            )}
            {erro && <p className="text-xs text-red-600 px-1">{erro}</p>}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-nex-gray-100 p-3">
            <div className="flex items-end gap-2">
              <textarea value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                rows={2} placeholder="Ex.: adicione uma seção sobre planos e preços…"
                className="flex-1 resize-none rounded-lg border border-nex-gray-200 px-3 py-2.5 text-sm placeholder:text-nex-gray-300 focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
              <button onClick={enviar} disabled={!input.trim() || loading}
                className="h-10 w-10 flex-shrink-0 rounded-lg bg-nex-black text-white hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Markdown atual */}
        <div className="flex flex-col bg-white border border-nex-gray-200 rounded-xl overflow-hidden min-h-0">
          <div className="border-b border-nex-gray-100 px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-heading font-semibold uppercase tracking-wide text-nex-gray-400">base-conhecimento-sdr.md</span>
          </div>
          <textarea
            value={markdown}
            onChange={e => persistir(e.target.value)}
            className="flex-1 resize-none p-4 text-[12px] font-mono leading-relaxed text-nex-gray-700 focus:outline-none"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}
