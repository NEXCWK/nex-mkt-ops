'use client'

import { useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'
import { Sparkles, Upload, RotateCcw, Loader2, LayoutDashboard, FileUp, ThumbsUp, AlertTriangle, X } from 'lucide-react'
import { DashboardAvaliacao } from './DashboardAvaliacao'
import { podeAcessarDashboardAvaliacao } from '@/lib/acesso-restrito'

interface Kpi { nome: string; nota: number; comentario: string }
interface PontoAtencao { tipo: 'objecao' | 'atrito' | 'ponto_forte'; texto: string; trecho: string }

interface ConversaResultado {
  id: string
  atendente: string
  data: string | null
  nota: number
  resumo: string
  kpis: Kpi[]
  pontos_atencao: PontoAtencao[]
  trecho: string
}

interface ResultadoEnvio {
  totalConversas: number
  notaMedia?: number
  conversas?: ConversaResultado[]
}

function notaText(n: number): string {
  if (n >= 8) return 'text-green-600'
  if (n >= 6) return 'text-yellow-600'
  if (n >= 4) return 'text-orange-600'
  return 'text-red-600'
}

interface Props {
  tipo: 'atendimento' | 'telefonema'
  titulo: string
  descricao: string
  placeholder: string
}

const AUDIO_EXTS = ['mp3', 'm4a', 'wav', 'ogg', 'oga', 'opus', 'mpeg', 'mpga', 'webm', 'aac', 'flac']
const ehAudio = (nome: string) => AUDIO_EXTS.includes(nome.toLowerCase().split('.').pop() ?? '')

export function AvaliacaoClient({ tipo, titulo, descricao, placeholder }: Props) {
  const permitirAudio = tipo === 'telefonema'
  const { data: session } = useSession()
  const podeVerAnalise = podeAcessarDashboardAvaliacao(session?.user?.email)
  const [aba, setAba] = useState<'enviar' | 'dashboard'>('enviar')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [atendente, setAtendente] = useState('')
  const [transcricoes, setTranscricoes] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoEnvio | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const algumAudio = arquivos.some(a => ehAudio(a.name))

  function removerArquivo(idx: number) {
    setArquivos(prev => prev.filter((_, i) => i !== idx))
  }

  async function avaliar() {
    if ((arquivos.length === 0 && !transcricoes.trim()) || loading) return
    setLoading(true)
    setErro(null)
    setResultado(null)
    try {
      let res: Response
      if (arquivos.length > 0) {
        const form = new FormData()
        form.append('tipo', tipo)
        for (const arquivo of arquivos) form.append('arquivo', arquivo)
        if (atendente.trim()) form.append('atendente', atendente.trim())
        res = await fetch('/api/avaliacao', { method: 'POST', body: form })
      } else {
        res = await fetch('/api/avaliacao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo, transcricoes }),
        })
      }
      const texto = await res.text()
      let json: Record<string, unknown> = {}
      try {
        json = texto ? JSON.parse(texto) : {}
      } catch {
        throw new Error(
          `O servidor demorou demais ou falhou ao responder (${res.status}). ` +
          'Tente novamente com menos arquivos por vez, ou aguarde um instante.'
        )
      }
      if (!res.ok) throw new Error((json.error as string) ?? `Erro ${res.status}`)
      setResultado(json as unknown as ResultadoEnvio)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao avaliar')
    } finally {
      setLoading(false)
    }
  }

  function novaAvaliacao() {
    setResultado(null)
    setTranscricoes('')
    setArquivos([])
    setAtendente('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div>
      <PageHeader
        title={titulo}
        description={descricao}
        actions={
          resultado ? (
            <button onClick={novaAvaliacao} className="flex items-center gap-1.5 text-xs text-nex-gray-400 hover:text-nex-black transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Nova avaliação
            </button>
          ) : undefined
        }
      />

      {/* Tabs: Enviar Transcrições / Dashboard (Dashboard só para quem tem acesso à análise) */}
      {podeVerAnalise && (
        <div className="flex gap-2 mb-5">
          <button onClick={() => setAba('enviar')}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-heading font-medium border transition-colors',
              aba === 'enviar' ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
            <FileUp className="w-3.5 h-3.5" /> Enviar Transcrições
          </button>
          <button onClick={() => setAba('dashboard')}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-heading font-medium border transition-colors',
              aba === 'dashboard' ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
            <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
          </button>
        </div>
      )}

      {aba === 'dashboard' && podeVerAnalise ? (
        <DashboardAvaliacao tipo={tipo} />
      ) : (
        <>
          {!resultado && (
            <div className="bg-white border border-nex-gray-200 rounded-xl p-5 space-y-4 max-w-3xl">
              <div>
                <label className="text-sm font-heading font-medium text-nex-gray-700 block mb-1.5">
                  {permitirAudio
                    ? 'Arquivo(s) da ligação (áudio .mp3) ou transcrição (PDF, CSV, Excel)'
                    : 'Arquivo(s) de transcrições (PDF, CSV ou Excel)'}
                </label>
                <label className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-nex-gray-300 text-sm text-nex-gray-500 hover:border-nex-gray-400 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4" />
                  {arquivos.length > 0
                    ? `${arquivos.length} arquivo(s) selecionado(s)`
                    : permitirAudio
                      ? 'Clique para selecionar um ou vários (.mp3, .m4a, .wav, .ogg, .pdf, .csv, .xlsx)'
                      : 'Clique para selecionar um ou vários arquivos (.pdf, .csv, .xlsx, .xls)'}
                  <input ref={fileInputRef} type="file" multiple
                    accept={permitirAudio ? '.mp3,.m4a,.wav,.ogg,.oga,.opus,.webm,.aac,.flac,.pdf,.csv,.xlsx,.xls,.txt' : '.pdf,.csv,.xlsx,.xls,.txt'}
                    onChange={e => setArquivos(Array.from(e.target.files ?? []))}
                    className="hidden" />
                </label>
                {arquivos.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {arquivos.map((a, i) => (
                      <li key={`${a.name}-${i}`} className="flex items-center justify-between gap-2 text-xs text-nex-gray-500 bg-nex-gray-50 rounded-md px-2.5 py-1.5">
                        <span className="truncate">{a.name}</span>
                        <button type="button" onClick={() => removerArquivo(i)} className="text-nex-gray-300 hover:text-red-500 flex-shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {permitirAudio && algumAudio ? (
                  <p className="text-[11px] text-nex-gray-400 mt-1">
                    Cada áudio será transcrito automaticamente para texto e depois avaliado. Limite de 25 MB por arquivo.
                  </p>
                ) : (
                  <p className="text-[11px] text-nex-gray-300 mt-1">
                    Não é preciso subir transcrições diariamente — pode enviar de uma vez o acumulado de vários dias, em um ou vários arquivos.
                    Cada atendimento deve trazer a identificação do atendente responsável.
                    {arquivos.length > 10 && ' Lotes grandes (dezenas de arquivos) podem levar alguns minutos para processar — a página permanece nesta tela até concluir.'}
                  </p>
                )}
              </div>

              {permitirAudio && algumAudio && (
                <div>
                  <label className="text-sm font-heading font-medium text-nex-gray-700 block mb-1.5">
                    Atendente responsável pela ligação <span className="text-nex-gray-300 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={atendente}
                    onChange={e => setAtendente(e.target.value)}
                    placeholder="Ex.: Maria Silva"
                    className="w-full rounded-lg border border-nex-gray-200 bg-white px-3 py-2.5 text-sm placeholder:text-nex-gray-300 focus:outline-none focus:ring-1 focus:ring-nex-gray-400 transition-colors"
                  />
                  <p className="text-[11px] text-nex-gray-300 mt-1">
                    Como o áudio não traz o nome escrito, informe o atendente para agrupar corretamente no dashboard.
                    Se enviar vários arquivos de uma vez, esse nome será aplicado a todas as ligações deste envio.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-nex-gray-100" />
                <span className="text-[11px] text-nex-gray-300">ou cole o texto diretamente</span>
                <div className="flex-1 h-px bg-nex-gray-100" />
              </div>

              <div>
                <textarea
                  value={transcricoes}
                  onChange={e => setTranscricoes(e.target.value)}
                  rows={10}
                  placeholder={placeholder}
                  disabled={arquivos.length > 0}
                  className="w-full resize-y rounded-lg border border-nex-gray-200 bg-white px-3 py-2.5 text-sm placeholder:text-nex-gray-300 focus:outline-none focus:ring-1 focus:ring-nex-gray-400 transition-colors font-mono disabled:bg-nex-gray-50 disabled:text-nex-gray-300"
                />
              </div>

              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <button
                onClick={avaliar}
                disabled={(arquivos.length === 0 && !transcricoes.trim()) || loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                {loading
                  ? (algumAudio ? 'Transcrevendo e analisando…' : 'Analisando com IA…')
                  : 'Analisar transcrições'}
              </button>
            </div>
          )}

          {resultado && !podeVerAnalise && (
            <div className="bg-white border border-nex-gray-200 rounded-xl p-5 flex items-center gap-6">
              <div>
                <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Atendimentos processados</p>
                <p className="text-3xl font-bold text-nex-black">{resultado.totalConversas}</p>
              </div>
              <p className="text-sm text-nex-gray-400 ml-auto">Envio concluído com sucesso.</p>
            </div>
          )}

          {resultado && podeVerAnalise && (
            <div className="space-y-5">
              <div className="bg-white border border-nex-gray-200 rounded-xl p-5 flex items-center gap-6">
                <div>
                  <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Conversas processadas</p>
                  <p className="text-3xl font-bold text-nex-black">{resultado.totalConversas}</p>
                </div>
                <div>
                  <p className="text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400 mb-1">Nota média do lote</p>
                  <p className={cn('text-3xl font-bold', notaText(resultado.notaMedia ?? 0))}>{(resultado.notaMedia ?? 0).toFixed(1)}</p>
                </div>
                <p className="text-sm text-nex-gray-400 ml-auto">
                  {resultado.totalConversas === 0
                    ? 'Nenhum atendimento com interação real foi encontrado (apenas encerramentos automáticos) — nada foi contabilizado.'
                    : (
                      <>Dados salvos. Veja a análise completa na aba <button onClick={() => setAba('dashboard')} className="underline text-nex-black font-medium">Dashboard</button>.</>
                    )}
                </p>
              </div>

              <div className="space-y-3">
                {(resultado.conversas ?? []).map((c, i) => (
                  <div key={i} className="bg-white border border-nex-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-heading font-semibold text-nex-gray-800">{c.atendente}</span>
                        {c.data && <span className="text-xs text-nex-gray-400 ml-2">{c.data}</span>}
                      </div>
                      <span className={cn('text-lg font-heading font-bold', notaText(c.nota))}>{Number(c.nota).toFixed(1)}</span>
                    </div>
                    <p className="text-sm text-nex-gray-600 mb-2">{c.resumo}</p>
                    {c.pontos_atencao?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {c.pontos_atencao.map((p, j) => (
                          <span key={j} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-heading font-medium',
                            p.tipo === 'ponto_forte' ? 'bg-green-50 text-green-700' : p.tipo === 'objecao' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600')}>
                            {p.tipo === 'ponto_forte' ? <ThumbsUp className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                            {p.texto}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
