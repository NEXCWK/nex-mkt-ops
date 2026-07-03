'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Sparkles, Download, Loader2, Code, Eye, Check, History, Wand2, FileArchive } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RepositorioHistorico } from '@/components/criacao/RepositorioHistorico'

type ModeloLP = 'lsl' | 'vsl' | 'squeeze'

interface Variante { nome: string; html: string }

const MODELOS: { id: ModeloLP; nome: string; oferta: string; estrutura: string }[] = [
  { id: 'lsl', nome: 'LSL — Long Sales Letter', oferta: 'Ticket alto, contrato longo, várias objeções (ex.: escritório privativo).', estrutura: 'Hero + 3 benefícios + urgência + formulário + regulamento.' },
  { id: 'vsl', nome: 'VSL — Video Sales Letter', oferta: 'Quando um vídeo/tour vende melhor (mesas fixas, tour do espaço).', estrutura: 'Hero curto + vídeo + benefícios + urgência + formulário + regulamento.' },
  { id: 'squeeze', nome: 'Squeeze', oferta: 'Oferta simples e urgente (pacote de horas, day-use, sala avulsa).', estrutura: 'Uma dobra única: hero à esquerda + formulário à direita.' },
]

// Prévia: injeta <base> para resolver ./styles.css e ./logo contra /lp-assets/
function comBase(html: string): string {
  return html.replace(/<head>/i, '<head>\n  <base href="/lp-assets/" />')
}

export default function CriadorLpPage() {
  const [aba, setAba] = useState<'gerar' | 'repositorio'>('gerar')

  const [modelo, setModelo] = useState<ModeloLP>('lsl')
  const [produto, setProduto] = useState('')
  const [vigencia, setVigencia] = useState('')
  const [desconto, setDesconto] = useState('')
  const [heroImage, setHeroImage] = useState('')
  const [videoEmbed, setVideoEmbed] = useState('')
  const [rdEmbed, setRdEmbed] = useState('')
  const [instrucoes, setInstrucoes] = useState('')

  // Campos opcionais de texto (sobrescrevem a IA quando preenchidos)
  const [heroTitle, setHeroTitle] = useState('')
  const [heroSubtitle, setHeroSubtitle] = useState('')
  const [heroBody, setHeroBody] = useState('')
  const [benefitsTitle, setBenefitsTitle] = useState('')
  const [benefits, setBenefits] = useState([
    { title: '', description: '' },
    { title: '', description: '' },
    { title: '', description: '' },
  ])
  const [mostrarOpcionais, setMostrarOpcionais] = useState(false)

  function setBenefit(i: number, patch: Partial<{ title: string; description: string }>) {
    setBenefits(prev => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)))
  }

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [variantes, setVariantes] = useState<Variante[] | null>(null)
  const [ativa, setAtiva] = useState(0)
  const [modo, setModo] = useState<'preview' | 'code'>('preview')
  const [salvando, setSalvando] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [baixandoZip, setBaixandoZip] = useState(false)

  async function gerar() {
    if (!produto.trim() || loading) return
    setLoading(true); setErro(null); setSalvo(false)
    try {
      const res = await fetch('/api/criador-lp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelo, produto, vigencia, desconto, heroImage, videoEmbed, rdEmbed, instrucoes,
          overrides: { heroTitle, heroSubtitle, heroBody, benefitsTitle, benefits },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setVariantes(json.variantes ?? [])
      setAtiva(0); setModo('preview')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar LP')
    } finally {
      setLoading(false)
    }
  }

  const atual = variantes?.[ativa]

  const [baixandoHtml, setBaixandoHtml] = useState(false)
  async function baixarHtml() {
    if (!atual || baixandoHtml) return
    setBaixandoHtml(true)
    try {
      // Busca a versão autossuficiente (CSS + fontes + logos embutidos) para o
      // arquivo funcionar sozinho ao abrir direto no navegador.
      const res = await fetch('/api/criador-lp/inline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: atual.html }),
      })
      const json = await res.json()
      const htmlFinal = res.ok && json.html ? json.html : atual.html
      const blob = new Blob([htmlFinal], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${produto.replace(/[^\w-]+/g, '-').toLowerCase() || 'landing-page'}.html`
      a.click(); URL.revokeObjectURL(url)
    } finally {
      setBaixandoHtml(false)
    }
  }

  async function baixarZip() {
    if (!atual || baixandoZip) return
    setBaixandoZip(true)
    try {
      const res = await fetch('/api/criador-lp/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: atual.html, nome: produto || 'landing-page' }),
      })
      if (!res.ok) throw new Error('Falha ao gerar o pacote .zip')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${produto.replace(/[^\w-]+/g, '-').toLowerCase() || 'landing-page'}.zip`
      a.click(); URL.revokeObjectURL(url)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao baixar o pacote')
    } finally {
      setBaixandoZip(false)
    }
  }

  async function escolher() {
    if (!atual || salvando) return
    setSalvando(true)
    try {
      const res = await fetch('/api/criacoes-historico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contexto: 'lp', produto, vigencia, desconto,
          titulo: `${MODELOS.find(m => m.id === modelo)?.nome.split(' ')[0]} · ${produto}`,
          descricao: instrucoes,
          conteudo: { modelo, html: atual.html },
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
      <PageHeader title="Criador de LP" description="Gere landing pages Nex a partir de 3 modelos (LSL, VSL, Squeeze). Duas opções por pedido, com identidade e fonte Proxima Nova fixas." />

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
            {/* Modelos */}
            <div>
              <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-2">Modelo</label>
              <div className="space-y-2">
                {MODELOS.map(m => (
                  <button key={m.id} onClick={() => setModelo(m.id)}
                    className={cn('w-full text-left p-3 rounded-lg border transition-colors',
                      modelo === m.id ? 'border-nex-black bg-nex-gray-50' : 'border-nex-gray-200 hover:bg-nex-gray-50')}>
                    <div className="flex items-center gap-2">
                      <span className={cn('w-3.5 h-3.5 rounded-full border flex-shrink-0', modelo === m.id ? 'bg-nex-black border-nex-black' : 'border-nex-gray-300')} />
                      <span className="text-sm font-heading font-semibold text-nex-gray-800">{m.nome}</span>
                    </div>
                    <p className="text-[11px] text-nex-gray-400 mt-1 ml-5.5">{m.oferta}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Produto *</label>
              <input value={produto} onChange={e => setProduto(e.target.value)} placeholder="Ex.: Escritório Privativo"
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

            <div>
              <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">URL da imagem de hero</label>
              <input value={heroImage} onChange={e => setHeroImage(e.target.value)} placeholder="https://…/imagem.jpg (opcional)"
                className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
            </div>

            {modelo === 'vsl' && (
              <div>
                <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Embed do vídeo (iframe do YouTube/Vimeo)</label>
                <textarea value={videoEmbed} onChange={e => setVideoEmbed(e.target.value)} rows={2}
                  placeholder='<iframe src="https://www.youtube.com/embed/ID" ...></iframe>'
                  className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
              </div>
            )}

            <div>
              <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Formulário do RD Station (cole o HTML/embed)</label>
              <textarea value={rdEmbed} onChange={e => setRdEmbed(e.target.value)} rows={3}
                placeholder="Cole aqui o embed do formulário publicado no RD Station. Se vazio, mantém um formulário de demonstração."
                className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
            </div>

            {/* Campos de texto opcionais (sobrescrevem a IA) */}
            <div className="border border-nex-gray-100 rounded-lg">
              <button type="button" onClick={() => setMostrarOpcionais(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-heading font-medium text-nex-gray-600 hover:text-nex-black">
                <span>Textos manuais (opcional) — hero e benefícios</span>
                <span className="text-nex-gray-400">{mostrarOpcionais ? '−' : '+'}</span>
              </button>
              {mostrarOpcionais && (
                <div className="px-3 pb-3 space-y-3 border-t border-nex-gray-100 pt-3">
                  <p className="text-[11px] text-nex-gray-400">Preencha só o que quiser fixar. O que ficar vazio, a IA escreve.</p>
                  <div>
                    <label className="text-[11px] font-heading font-medium text-nex-gray-500 block mb-1">Título do Banner Hero</label>
                    <input value={heroTitle} onChange={e => setHeroTitle(e.target.value)}
                      className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                  </div>
                  <div>
                    <label className="text-[11px] font-heading font-medium text-nex-gray-500 block mb-1">Subtítulo do Banner Hero</label>
                    <input value={heroSubtitle} onChange={e => setHeroSubtitle(e.target.value)}
                      className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                  </div>
                  <div>
                    <label className="text-[11px] font-heading font-medium text-nex-gray-500 block mb-1">Corpo do texto do Banner Hero</label>
                    <textarea value={heroBody} onChange={e => setHeroBody(e.target.value)} rows={2}
                      className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                  </div>
                  {modelo !== 'squeeze' && (
                    <>
                      <div>
                        <label className="text-[11px] font-heading font-medium text-nex-gray-500 block mb-1">Título da Dobra 2 (benefícios)</label>
                        <input value={benefitsTitle} onChange={e => setBenefitsTitle(e.target.value)}
                          className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                      </div>
                      {benefits.map((b, i) => (
                        <div key={i} className="grid grid-cols-1 gap-1.5 border-l-2 border-nex-gray-100 pl-2">
                          <span className="text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Benefício {i + 1}</span>
                          <input value={b.title} onChange={e => setBenefit(i, { title: e.target.value })} placeholder="Título"
                            className="w-full rounded-lg border border-nex-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                          <input value={b.description} onChange={e => setBenefit(i, { description: e.target.value })} placeholder="Descrição"
                            className="w-full rounded-lg border border-nex-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Instruções extras (opcional)</label>
              <textarea value={instrucoes} onChange={e => setInstrucoes(e.target.value)} rows={3}
                placeholder="Público-alvo, ângulo de copy, benefícios a destacar, etc."
                className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
            </div>

            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button onClick={gerar} disabled={!produto.trim() || loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? 'Gerando duas opções…' : 'Gerar 2 opções'}
            </button>
          </div>

          {/* Resultado */}
          <div className="lg:col-span-3 bg-white border border-nex-gray-200 rounded-xl overflow-hidden flex flex-col min-h-[580px]">
            {variantes && variantes.length > 0 && (
              <div className="flex items-center gap-2 border-b border-nex-gray-100 px-3 py-2 flex-wrap">
                {variantes.map((v, i) => (
                  <button key={i} onClick={() => { setAtiva(i); setSalvo(false) }}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-heading font-medium transition-colors',
                      ativa === i ? 'bg-nex-black text-white' : 'text-nex-gray-500 hover:bg-nex-gray-50')}>
                    {v.nome || `Opção ${i + 1}`}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between border-b border-nex-gray-100 px-3 py-2 flex-wrap gap-2">
              <div className="flex gap-1">
                {([['preview', 'Prévia', Eye], ['code', 'HTML', Code]] as const).map(([key, label, Icon]) => (
                  <button key={key} onClick={() => setModo(key)}
                    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-medium transition-colors',
                      modo === key ? 'bg-nex-gray-100 text-nex-black' : 'text-nex-gray-400 hover:text-nex-gray-700')}>
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>
              {atual && (
                <div className="flex items-center gap-3">
                  <button onClick={baixarHtml} disabled={baixandoHtml} className="flex items-center gap-1.5 text-xs text-nex-gray-500 hover:text-nex-black disabled:opacity-40">
                    {baixandoHtml ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} .html
                  </button>
                  <button onClick={baixarZip} disabled={baixandoZip} className="flex items-center gap-1.5 text-xs text-nex-gray-500 hover:text-nex-black disabled:opacity-40">
                    {baixandoZip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileArchive className="w-3.5 h-3.5" />} pacote .zip
                  </button>
                  <button onClick={escolher} disabled={salvando}
                    className={cn('flex items-center gap-1.5 text-xs font-heading font-medium px-3 py-1.5 rounded-lg transition-colors',
                      salvo ? 'bg-green-50 text-green-700' : 'bg-nex-black text-white hover:bg-nex-gray-700')}>
                    {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {salvo ? 'Escolhida' : 'Escolher esta'}
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto">
              {!atual ? (
                <div className="h-full flex items-center justify-center text-sm text-nex-gray-300 px-6 text-center">
                  As duas opções de landing page aparecerão aqui. Escolha um modelo, preencha o produto e gere.
                </div>
              ) : modo === 'preview' ? (
                <iframe title="preview" srcDoc={comBase(atual.html)} className="w-full h-full min-h-[480px] border-0" sandbox="allow-scripts" />
              ) : (
                <pre className="text-[11px] font-mono p-4 whitespace-pre-wrap text-nex-gray-700">{atual.html}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
