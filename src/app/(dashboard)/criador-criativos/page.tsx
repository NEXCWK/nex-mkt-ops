'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Sparkles, Download, Loader2, ImageDown, Check, History, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModeloReferenciaPicker } from '@/components/criacao/ModeloReferenciaPicker'
import { RepositorioHistorico } from '@/components/criacao/RepositorioHistorico'

type Formato = 'quadrado' | 'retangulo'
type Tipo = 'estatico' | 'carrossel'

interface Slide {
  titulo: string
  legenda: string
  html: string
}

interface Variante {
  nome: string
  porFormato: Record<string, Slide[]>
}

const FORMATOS: { id: Formato; label: string; ratio: string }[] = [
  { id: 'quadrado', label: 'Quadrado 1:1', ratio: '1 / 1' },
  { id: 'retangulo', label: 'Retângulo 4:5', ratio: '4 / 5' },
]

export default function CriadorCriativosPage() {
  const [aba, setAba] = useState<'gerar' | 'repositorio'>('gerar')

  const [formatos, setFormatos] = useState<Formato[]>(['quadrado'])
  const [tipo, setTipo] = useState<Tipo>('estatico')
  const [nSlides, setNSlides] = useState(3)
  const [titulo, setTitulo] = useState('')
  const [subtitulo, setSubtitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [produto, setProduto] = useState('')
  const [vigencia, setVigencia] = useState('')
  const [desconto, setDesconto] = useState('')
  const [modeloId, setModeloId] = useState('')

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [variantes, setVariantes] = useState<Variante[] | null>(null)
  const [legendaPost, setLegendaPost] = useState('')
  const [varianteAtiva, setVarianteAtiva] = useState(0)
  const [exportando, setExportando] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)

  function toggleFormato(f: Formato) {
    setFormatos(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  async function gerar() {
    if (formatos.length === 0 || loading) return
    setLoading(true)
    setErro(null)
    setSalvo(false)
    try {
      const r = await fetch('/api/criador-criativos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo, subtitulo, texto, produto, vigencia, desconto,
          formatos, tipo, nSlides: tipo === 'carrossel' ? nSlides : 1,
          modeloId: modeloId || undefined,
        }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error ?? `Erro ${r.status}`)
      setVariantes(json.variantes ?? [])
      setLegendaPost(json.legendaPost ?? '')
      setVarianteAtiva(0)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar criativos')
    } finally {
      setLoading(false)
    }
  }

  function baixar(slide: Slide, nome: string) {
    const blob = new Blob([slide.html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${nome}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function baixarPng(slide: Slide, nome: string, dim: { w: number; h: number }) {
    if (exportando !== null) return
    setExportando(nome)
    try {
      const { w, h } = dim
      const parsed = new DOMParser().parseFromString(slide.html, 'text/html')
      parsed.documentElement.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
      const xhtml = new XMLSerializer().serializeToString(parsed.documentElement)
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
        `<foreignObject x="0" y="0" width="${w}" height="${h}">${xhtml}</foreignObject></svg>`
      const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Falha ao renderizar a imagem'))
        img.src = svgUrl
      })

      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = w * scale
      canvas.height = h * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas indisponível')
      ctx.scale(scale, scale)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)

      await new Promise<void>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('Falha ao gerar PNG'))
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${nome}.png`
          a.click()
          URL.revokeObjectURL(url)
          resolve()
        }, 'image/png')
      })
    } catch (e) {
      setErro(`Não foi possível exportar em PNG (${e instanceof Error ? e.message : 'erro'}). Use o download em HTML como alternativa.`)
    } finally {
      setExportando(null)
    }
  }

  async function escolherVariante() {
    const atual = variantes?.[varianteAtiva]
    if (!atual || salvando) return
    setSalvando(true)
    try {
      const res = await fetch('/api/criacoes-historico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contexto: 'criativo',
          produto, vigencia, desconto,
          titulo: titulo || produto || 'Criativo',
          descricao: texto,
          conteudo: { porFormato: atual.porFormato },
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

  const atual = variantes?.[varianteAtiva]

  return (
    <div>
      <PageHeader title="Criador de Criativos" description="Gere criativos para Instagram a partir de campos estruturados, escolha entre duas opções e mantenha um repositório." />

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
        <RepositorioHistorico contexto="criativo" />
      ) : (
        <>
          <div className="bg-white border border-nex-gray-200 rounded-xl p-5 mb-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1.5">Formatos (pode escolher os dois)</label>
                <div className="flex gap-2">
                  {FORMATOS.map(f => (
                    <button key={f.id} type="button" onClick={() => toggleFormato(f.id)}
                      className={cn('flex-1 px-3 py-2 rounded-lg text-xs font-heading font-medium border transition-colors',
                        formatos.includes(f.id) ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1.5">Tipo</label>
                <div className="flex gap-2">
                  {(['estatico', 'carrossel'] as Tipo[]).map(t => (
                    <button key={t} onClick={() => setTipo(t)}
                      className={cn('flex-1 px-3 py-2 rounded-lg text-xs font-heading font-medium border transition-colors capitalize',
                        tipo === t ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {tipo === 'carrossel' && (
                <div>
                  <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1.5">Nº de slides</label>
                  <input type="number" min={2} max={8} value={nSlides} onChange={e => setNSlides(Number(e.target.value))}
                    className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Título</label>
                <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Seu escritório pronto para usar"
                  className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
              </div>
              <div>
                <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Subtítulo</label>
                <input value={subtitulo} onChange={e => setSubtitulo(e.target.value)} placeholder="Ex.: Sem burocracia, sem fiador"
                  className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
              </div>
              <div>
                <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Produto</label>
                <input value={produto} onChange={e => setProduto(e.target.value)} placeholder="Ex.: Escritório Privativo"
                  className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Vigência</label>
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
              <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Texto / briefing adicional</label>
              <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={4}
                placeholder="Detalhes livres do anúncio, público-alvo, CTA desejado, etc."
                className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
            </div>

            <ModeloReferenciaPicker contexto="criativo" modeloId={modeloId} onChange={setModeloId} />

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button onClick={gerar} disabled={formatos.length === 0 || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Criando duas opções…' : 'Gerar 2 opções de criativo'}
            </button>
          </div>

          {variantes && variantes.length > 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                {variantes.map((v, i) => (
                  <button key={i} onClick={() => { setVarianteAtiva(i); setSalvo(false) }}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-heading font-medium border transition-colors',
                      varianteAtiva === i ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
                    {v.nome || `Opção ${i + 1}`}
                  </button>
                ))}
                <button onClick={escolherVariante} disabled={salvando}
                  className={cn('ml-auto flex items-center gap-1.5 text-xs font-heading font-medium px-3 py-1.5 rounded-lg transition-colors',
                    salvo ? 'bg-green-50 text-green-700' : 'bg-nex-black text-white hover:bg-nex-gray-700')}>
                  {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {salvo ? 'Escolhida' : 'Escolher esta opção'}
                </button>
              </div>

              {atual && Object.entries(atual.porFormato).map(([formatoKey, slides]) => {
                const formatoInfo = FORMATOS.find(f => f.id === formatoKey)
                const dim = formatoKey === 'retangulo' ? { w: 1080, h: 1350 } : { w: 1080, h: 1080 }
                return (
                  <div key={formatoKey}>
                    <h3 className="text-xs font-heading font-semibold uppercase tracking-wide text-nex-gray-400 mb-2">{formatoInfo?.label ?? formatoKey}</h3>
                    <div className="flex flex-wrap gap-5">
                      {slides.map((s, i) => {
                        const nome = `criativo-${formatoKey}-op${varianteAtiva + 1}-${i + 1}`
                        return (
                          <div key={i} className="w-64">
                            <div className="rounded-xl overflow-hidden border border-nex-gray-200 bg-white" style={{ aspectRatio: formatoInfo?.ratio }}>
                              <iframe title={nome} srcDoc={s.html} className="w-full h-full border-0" sandbox="" />
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-nex-gray-500 truncate pr-2">{tipo === 'carrossel' ? `Slide ${i + 1}` : 'Criativo'} · {s.titulo}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button onClick={() => baixarPng(s, nome, dim)} disabled={exportando !== null} title="Baixar PNG (alta qualidade)"
                                  className="flex items-center gap-1 text-xs text-nex-gray-500 hover:text-nex-black disabled:opacity-40">
                                  {exportando === nome ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageDown className="w-3.5 h-3.5" />} PNG
                                </button>
                                <button onClick={() => baixar(s, nome)} title="Baixar HTML" className="text-nex-gray-400 hover:text-nex-black"><Download className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {legendaPost && (
                <div className="bg-white border border-nex-gray-200 rounded-xl p-5 max-w-2xl">
                  <h3 className="text-sm font-heading font-semibold text-nex-black mb-2">Legenda do post</h3>
                  <p className="text-sm text-nex-gray-600 whitespace-pre-wrap">{legendaPost}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
