'use client'

import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { Send, MessageSquareText, Copy, Check, RotateCcw, Square, Sparkles, PencilLine } from 'lucide-react'

type ChatMessage = { role: 'user' | 'assistant'; content: string }
type Modo = 'gerar' | 'editar'

const SUGESTOES = [
  'Mensagem inicial de boas-vindas para lead de Escritório Virtual',
  'Template de primeiro contato para prospecção de salas privativas',
  'Convite para visita/tour no Nex House',
  'Reativação de lead que pediu informações e sumiu',
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="flex items-center gap-1 text-[11px] text-nex-gray-400 hover:text-nex-black transition-colors"
      title="Copiar template"
    >
      {copied ? <><Check className="w-3 h-3 text-green-500" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
    </button>
  )
}

export default function GeradorTemplatePage() {
  const [modo, setModo] = useState<Modo>('gerar')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(texto?: string) {
    const content = (texto ?? input).trim()
    if (!content || loading) return
    const novas: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages([...novas, { role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch('/api/waba-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: novas, modo }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Erro ${res.status}`)
      }
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        const final = acc
        setMessages(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: final }
          return copy
        })
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        setMessages(prev => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          copy[copy.length - 1] = { role: 'assistant', content: last.content || `Não consegui gerar: ${(e as Error)?.message ?? 'erro desconhecido'}` }
          return copy
        })
      }
    } finally {
      setLoading(false)
      abortRef.current = null
      inputRef.current?.focus()
    }
  }

  function stop() { abortRef.current?.abort() }
  function reset() { if (loading) stop(); setMessages([]); setInput('') }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <PageHeader
        title="Gerador de Template/Script"
        description="Crie ou ajuste templates de mensagem inicial do WhatsApp (WABA) no tom de voz do Nex."
        actions={
          messages.length > 0 ? (
            <button onClick={reset} className="flex items-center gap-1.5 text-xs text-nex-gray-400 hover:text-nex-black transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Nova conversa
            </button>
          ) : undefined
        }
      />

      {/* Modo */}
      <div className="flex gap-2 mb-3">
        {([['gerar', 'Gerar a partir de briefing', Sparkles], ['editar', 'Editar texto já pronto', PencilLine]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setModo(key)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-medium border transition-colors',
              modo === key ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col bg-white border border-nex-gray-200 rounded-xl overflow-hidden min-h-0">
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-5">
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-nex-gray-50 border border-nex-gray-200 flex items-center justify-center">
                  <MessageSquareText className="w-4.5 h-4.5 text-nex-gray-400" />
                </div>
                <p className="text-sm text-nex-gray-400 text-center max-w-md">
                  {modo === 'gerar'
                    ? 'Descreva o objetivo da mensagem inicial. O template sai pronto e dentro das regras de caracteres do WhatsApp (WABA), no tom de voz do Nex.'
                    : 'Cole um texto já pronto. Eu adapto para um template WABA válido e aprovável, no tom do Nex, sinalizando o que mudou.'}
                </p>
              </div>
              {modo === 'gerar' && (
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {SUGESTOES.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="px-3 py-1.5 rounded-lg text-xs font-heading font-medium bg-nex-gray-50 text-nex-gray-600 hover:bg-nex-gray-100 hover:text-nex-black border border-nex-gray-200 transition-colors text-left">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] rounded-xl px-4 py-3',
                  m.role === 'user' ? 'bg-nex-black text-white' : 'bg-nex-gray-50 border border-nex-gray-100 text-nex-gray-800')}>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed font-mono">
                    {m.content || (
                      <span className="inline-flex gap-1 items-center text-nex-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-nex-gray-300 animate-pulse" />
                        <span className="w-1.5 h-1.5 rounded-full bg-nex-gray-300 animate-pulse [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-nex-gray-300 animate-pulse [animation-delay:300ms]" />
                      </span>
                    )}
                  </div>
                  {m.role === 'assistant' && m.content && (!loading || i < messages.length - 1) && (
                    <div className="mt-2 pt-2 border-t border-nex-gray-200/60">
                      <CopyButton text={m.content} />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-nex-gray-100 p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              rows={modo === 'editar' ? 4 : 2}
              placeholder={modo === 'gerar'
                ? 'Ex.: mensagem de boas-vindas para quem pediu orçamento de Escritório Virtual, convidando para tirar dúvidas...'
                : 'Cole aqui o texto pronto que você quer transformar em template WABA...'}
              className="flex-1 resize-none rounded-lg border border-nex-gray-200 bg-white px-3 py-2.5 text-sm placeholder:text-nex-gray-300 focus:outline-none focus:ring-1 focus:ring-nex-gray-400 focus:border-nex-gray-400 transition-colors"
            />
            {loading ? (
              <button onClick={stop} title="Parar"
                className="h-10 w-10 flex-shrink-0 rounded-lg bg-nex-gray-100 text-nex-gray-600 hover:bg-nex-gray-200 flex items-center justify-center transition-colors">
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => send()} disabled={!input.trim()} title="Enviar"
                className="h-10 w-10 flex-shrink-0 rounded-lg bg-nex-black text-white hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center transition-colors">
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-nex-gray-300 mt-1.5 px-0.5">
            Enter envia · Shift+Enter quebra linha · BODY até 1024 caracteres, HEADER/FOOTER até 60, botões até 25 · variáveis {'{{1}}'}, {'{{2}}'}
          </p>
        </div>
      </div>
    </div>
  )
}
