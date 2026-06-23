'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Sparkles, Download, Loader2, Code, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

const MODELOS = [
  { id: 'modelo-1', nome: 'Modelo 1', desc: 'Aguardando definição (será enviado futuramente).' },
  { id: 'modelo-2', nome: 'Modelo 2', desc: 'Aguardando definição (será enviado futuramente).' },
  { id: 'modelo-3', nome: 'Modelo 3', desc: 'Aguardando definição (será enviado futuramente).' },
]

export default function CriadorLpPage() {
  const [modelo, setModelo] = useState('modelo-1')
  const [objetivo, setObjetivo] = useState('')
  const [detalhes, setDetalhes] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [head, setHead] = useState('')
  const [body, setBody] = useState('')
  const [aba, setAba] = useState<'preview' | 'head' | 'body'>('preview')

  async function gerar() {
    if (!objetivo.trim() || loading) return
    setLoading(true)
    setErro(null)
    try {
      const res = await fetch('/api/criador-lp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelo, objetivo, detalhes }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setHead(json.head ?? '')
      setBody(json.body ?? '')
      setAba('preview')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar LP')
    } finally {
      setLoading(false)
    }
  }

  const documentoCompleto = head || body
    ? `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>`
    : ''

  function baixar() {
    const blob = new Blob([documentoCompleto], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `landing-page-${modelo}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader title="Criador de LP" description="Gere landing pages (head + body) em HTML/JS a partir de modelos definidos." />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Form */}
        <div className="lg:col-span-2 bg-white border border-nex-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1.5">Modelo de LP</label>
            <div className="space-y-2">
              {MODELOS.map(m => (
                <label key={m.id} className={cn('flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors',
                  modelo === m.id ? 'border-nex-black bg-nex-gray-50' : 'border-nex-gray-200 hover:bg-nex-gray-50')}>
                  <input type="radio" name="modelo" checked={modelo === m.id} onChange={() => setModelo(m.id)} className="mt-0.5" />
                  <div>
                    <div className="text-sm font-heading font-medium text-nex-gray-800">{m.nome}</div>
                    <div className="text-[11px] text-nex-gray-400">{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Objetivo da landing page</label>
            <input value={objetivo} onChange={e => setObjetivo(e.target.value)} placeholder="Ex.: captar leads para Escritório Virtual"
              className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          </div>
          <div>
            <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Detalhes / seções / oferta</label>
            <textarea value={detalhes} onChange={e => setDetalhes(e.target.value)} rows={8}
              placeholder="Headline desejada, benefícios, prova social, CTA, formulário, cores, etc."
              className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button onClick={gerar} disabled={!objetivo.trim() || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Gerando…' : 'Gerar landing page'}
          </button>
          <p className="text-[11px] text-nex-gray-300">
            Os 3 modelos finais serão definidos e enviados futuramente — o gerador já está pronto para recebê-los.
          </p>
        </div>

        {/* Resultado */}
        <div className="lg:col-span-3 bg-white border border-nex-gray-200 rounded-xl overflow-hidden flex flex-col min-h-[520px]">
          <div className="flex items-center justify-between border-b border-nex-gray-100 px-3 py-2">
            <div className="flex gap-1">
              {([['preview', 'Prévia', Eye], ['head', 'head', Code], ['body', 'body', Code]] as const).map(([key, label, Icon]) => (
                <button key={key} onClick={() => setAba(key)}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-medium transition-colors',
                    aba === key ? 'bg-nex-gray-100 text-nex-black' : 'text-nex-gray-400 hover:text-nex-gray-700')}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
            {documentoCompleto && (
              <button onClick={baixar} className="flex items-center gap-1.5 text-xs text-nex-gray-500 hover:text-nex-black">
                <Download className="w-3.5 h-3.5" /> Baixar .html
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto">
            {!documentoCompleto ? (
              <div className="h-full flex items-center justify-center text-sm text-nex-gray-300">A landing page aparecerá aqui.</div>
            ) : aba === 'preview' ? (
              <iframe title="preview" srcDoc={documentoCompleto} className="w-full h-full min-h-[460px] border-0" sandbox="allow-scripts" />
            ) : (
              <pre className="text-[11px] font-mono p-4 whitespace-pre-wrap text-nex-gray-700">{aba === 'head' ? head : body}</pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
