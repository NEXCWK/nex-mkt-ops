'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Sparkles, Download, Loader2, Code, Eye, Check, History, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModeloReferenciaPicker } from '@/components/criacao/ModeloReferenciaPicker'
import { RepositorioHistorico } from '@/components/criacao/RepositorioHistorico'

interface Variante {
  nome: string
  head: string
  body: string
  js: string
}

export default function CriadorLpPage() {
  const [aba, setAba] = useState<'gerar' | 'repositorio'>('gerar')

  const [produto, setProduto] = useState('')
  const [vigencia, setVigencia] = useState('')
  const [desconto, setDesconto] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [detalhes, setDetalhes] = useState('')
  const [modeloId, setModeloId] = useState('')

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [variantes, setVariantes] = useState<Variante[] | null>(null)
  const [varianteAtiva, setVarianteAtiva] = useState(0)
  const [abaConteudo, setAbaConteudo] = useState<'preview' | 'head' | 'body' | 'js'>('preview')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  async function gerar() {
    if (!objetivo.trim() || loading) return
    setLoading(true)
    setErro(null)
    setSalvo(false)
    try {
      const res = await fetch('/api/criador-lp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produto, vigencia, desconto, objetivo, detalhes, modeloId: modeloId || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setVariantes(json.variantes ?? [])
      setVarianteAtiva(0)
      setAbaConteudo('preview')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar LP')
    } finally {
      setLoading(false)
    }
  }

  const atual = variantes?.[varianteAtiva]
  const documentoCompleto = atual ? `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n${atual.head}\n</head>\n<body>\n${atual.body}\n<script>${atual.js}</script>\n</body>\n</html>` : ''

  function baixar() {
    if (!documentoCompleto) return
    const blob = new Blob([documentoCompleto], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `landing-page-${varianteAtiva + 1}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  function baixarJs() {
    if (!atual?.js) return
    const blob = new Blob([atual.js], { type: 'text/javascript;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `landing-page-${varianteAtiva + 1}.js`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function escolherVariante() {
    if (!atual || salvando) return
    setSalvando(true)
    try {
      const res = await fetch('/api/criacoes-historico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contexto: 'lp',
          produto, vigencia, desconto,
          titulo: objetivo,
          descricao: detalhes,
          conteudo: { head: atual.head, body: atual.body, js: atual.js },
        }),
      })
      if (!res.ok) throw new Error()
      setSalvo(true)
    } catch {
      setErro('Falha ao salvar no repositório')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div>
      <PageHeader title="Criador de LP" description="Gere landing pages (HTML/CSS/JS) a partir de campos estruturados, escolha entre duas opções e mantenha um repositório." />

      <div className="flex gap-2 mb-5">
        <button onClick={() => setAba('gerar')}
          className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-heading font-medium border transition-colors',
            aba === 'gerar' ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
          <Wand2 className="w-3.5 h-3.5" /> Gerar
        </button>
        <button onClick={() => setAba('repositorio')}
          className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-heading font-medium border transition-colors',
            aba === 'repositorio' ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
          <History className="w-3.5 h-3.5" /> Repositório
        </button>
      </div>

      {aba === 'repositorio' ? (
        <RepositorioHistorico contexto="lp" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Form */}
          <div className="lg:col-span-2 bg-white border border-nex-gray-200 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Produto</label>
                <input value={produto} onChange={e => setProduto(e.target.value)} placeholder="Ex.: Escritório Virtual"
                  className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Vigência da ação</label>
                  <input value={vigencia} onChange={e => setVigencia(e.target.value)} placeholder="Ex.: até 31/07"
                    className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                </div>
                <div>
                  <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Desconto/condição</label>
                  <input value={desconto} onChange={e => setDesconto(e.target.value)} placeholder="Ex.: 20% off"
                    className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Objetivo da landing page *</label>
              <input value={objetivo} onChange={e => setObjetivo(e.target.value)} placeholder="Ex.: captar leads para Escritório Virtual"
                className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
            </div>
            <div>
              <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Detalhes / seções / oferta</label>
              <textarea value={detalhes} onChange={e => setDetalhes(e.target.value)} rows={6}
                placeholder="Headline desejada, benefícios, prova social, CTA, formulário, cores, etc."
                className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
            </div>
            <ModeloReferenciaPicker contexto="lp" modeloId={modeloId} onChange={setModeloId} />
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button onClick={gerar} disabled={!objetivo.trim() || loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Gerando duas opções…' : 'Gerar 2 opções de landing page'}
            </button>
          </div>

          {/* Resultado */}
          <div className="lg:col-span-3 bg-white border border-nex-gray-200 rounded-xl overflow-hidden flex flex-col min-h-[560px]">
            {variantes && variantes.length > 0 && (
              <div className="flex items-center gap-2 border-b border-nex-gray-100 px-3 py-2">
                {variantes.map((v, i) => (
                  <button key={i} onClick={() => { setVarianteAtiva(i); setSalvo(false) }}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-heading font-medium transition-colors',
                      varianteAtiva === i ? 'bg-nex-black text-white' : 'text-nex-gray-500 hover:bg-nex-gray-50')}>
                    {v.nome || `Opção ${i + 1}`}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between border-b border-nex-gray-100 px-3 py-2">
              <div className="flex gap-1">
                {([['preview', 'Prévia', Eye], ['head', 'head', Code], ['body', 'body', Code], ['js', 'js', Code]] as const).map(([key, label, Icon]) => (
                  <button key={key} onClick={() => setAbaConteudo(key)}
                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-medium transition-colors',
                      abaConteudo === key ? 'bg-nex-gray-100 text-nex-black' : 'text-nex-gray-400 hover:text-nex-gray-700')}>
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>
              {documentoCompleto && (
                <div className="flex items-center gap-3">
                  <button onClick={baixarJs} className="flex items-center gap-1.5 text-xs text-nex-gray-500 hover:text-nex-black">
                    <Download className="w-3.5 h-3.5" /> .js
                  </button>
                  <button onClick={baixar} className="flex items-center gap-1.5 text-xs text-nex-gray-500 hover:text-nex-black">
                    <Download className="w-3.5 h-3.5" /> .html
                  </button>
                  <button onClick={escolherVariante} disabled={salvando}
                    className={cn('flex items-center gap-1.5 text-xs font-heading font-medium px-3 py-1.5 rounded-lg transition-colors',
                      salvo ? 'bg-green-50 text-green-700' : 'bg-nex-black text-white hover:bg-nex-gray-700')}>
                    {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {salvo ? 'Escolhida' : 'Escolher esta'}
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto">
              {!documentoCompleto ? (
                <div className="h-full flex items-center justify-center text-sm text-nex-gray-300">As duas opções de landing page aparecerão aqui.</div>
              ) : abaConteudo === 'preview' ? (
                <iframe title="preview" srcDoc={documentoCompleto} className="w-full h-full min-h-[460px] border-0" sandbox="allow-scripts" />
              ) : (
                <pre className="text-[11px] font-mono p-4 whitespace-pre-wrap text-nex-gray-700">
                  {abaConteudo === 'head' ? atual?.head : abaConteudo === 'body' ? atual?.body : atual?.js}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
