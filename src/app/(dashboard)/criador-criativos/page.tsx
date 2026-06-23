'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Sparkles, Download, Loader2, ImageDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type Formato = 'quadrado' | 'retangulo'
type Tipo = 'estatico' | 'carrossel'

interface Slide {
  titulo: string
  legenda: string
  html: string
}

interface Resultado {
  slides: Slide[]
  legendaPost: string
}

export default function CriadorCriativosPage() {
  const [formato, setFormato] = useState<Formato>('quadrado')
  const [tipo, setTipo] = useState<Tipo>('estatico')
  const [nSlides, setNSlides] = useState(3)
  const [briefing, setBriefing] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [res, setRes] = useState<Resultado | null>(null)

  const ratio = formato === 'quadrado' ? '1 / 1' : '4 / 5'
  const dim = formato === 'quadrado' ? { w: 1080, h: 1080 } : { w: 1080, h: 1350 }
  const [exportando, setExportando] = useState<number | null>(null)

  async function gerar() {
    if (!briefing.trim() || loading) return
    setLoading(true)
    setErro(null)
    try {
      const r = await fetch('/api/criador-criativos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formato, tipo, nSlides: tipo === 'carrossel' ? nSlides : 1, briefing }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error ?? `Erro ${r.status}`)
      setRes(json as Resultado)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar criativos')
    } finally {
      setLoading(false)
    }
  }

  function baixar(slide: Slide, i: number) {
    const blob = new Blob([slide.html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `criativo-${formato}-${i + 1}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Exporta o criativo em PNG de alta qualidade (sem dependências externas). */
  async function baixarPng(slide: Slide, i: number) {
    if (exportando !== null) return
    setExportando(i)
    try {
      const { w, h } = dim
      // Normaliza o HTML para XML válido (fecha tags vazias etc.) via DOM.
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

      const scale = 2 // alta qualidade (ex.: 2160px no lado maior)
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
          a.download = `criativo-${formato}-${i + 1}.png`
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

  return (
    <div>
      <PageHeader title="Criador de Criativos" description="Crie criativos para Instagram (quadrado e retângulo, estático e carrossel)." />

      <div className="bg-white border border-nex-gray-200 rounded-xl p-5 mb-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1.5">Formato</label>
            <div className="flex gap-2">
              {(['quadrado', 'retangulo'] as Formato[]).map(f => (
                <button key={f} onClick={() => setFormato(f)}
                  className={cn('flex-1 px-3 py-2 rounded-lg text-xs font-heading font-medium border transition-colors',
                    formato === f ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
                  {f === 'quadrado' ? 'Quadrado 1:1' : 'Retângulo 4:5'}
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
        <div>
          <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Briefing do anúncio</label>
          <textarea value={briefing} onChange={e => setBriefing(e.target.value)} rows={5}
            placeholder="Ex.: anúncio para Escritório Virtual a partir de R$ 99/mês, foco em MEIs e contadores, CTA 'Garanta seu endereço fiscal'."
            className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button onClick={gerar} disabled={!briefing.trim() || loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Criando…' : 'Gerar criativos'}
        </button>
        <p className="text-[11px] text-nex-gray-300">
          Modelos visuais finais serão definidos e enviados futuramente — por ora os criativos seguem a identidade Nex.
        </p>
      </div>

      {res && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-5">
            {res.slides.map((s, i) => (
              <div key={i} className="w-64">
                <div className="rounded-xl overflow-hidden border border-nex-gray-200 bg-white" style={{ aspectRatio: ratio }}>
                  <iframe title={`slide-${i}`} srcDoc={s.html} className="w-full h-full border-0" sandbox="" />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-nex-gray-500 truncate pr-2">{tipo === 'carrossel' ? `Slide ${i + 1}` : 'Criativo'} · {s.titulo}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => baixarPng(s, i)} disabled={exportando !== null} title="Baixar PNG (alta qualidade)"
                      className="flex items-center gap-1 text-xs text-nex-gray-500 hover:text-nex-black disabled:opacity-40">
                      {exportando === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageDown className="w-3.5 h-3.5" />} PNG
                    </button>
                    <button onClick={() => baixar(s, i)} title="Baixar HTML" className="text-nex-gray-400 hover:text-nex-black"><Download className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {res.legendaPost && (
            <div className="bg-white border border-nex-gray-200 rounded-xl p-5 max-w-2xl">
              <h3 className="text-sm font-heading font-semibold text-nex-black mb-2">Legenda do post</h3>
              <p className="text-sm text-nex-gray-600 whitespace-pre-wrap">{res.legendaPost}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
