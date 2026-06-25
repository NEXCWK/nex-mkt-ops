'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import {
  Sparkles, Upload, Download, Check, AlertTriangle,
  MessageSquare, Loader2, FileText, X, ChevronRight, RefreshCw, Plus, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Substituicao = {
  original: string
  token: string
  contexto?: string
}

type TemplateExistente = { tipo: string; nome: string; versao: number; campos?: string[] }

/** Similaridade entre nomes de template (Jaccard sobre conjunto de palavras normalizadas). */
function palavrasChave(s: string): Set<string> {
  return new Set(
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  )
}
function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  a.forEach(w => { if (b.has(w)) inter++ })
  return inter / new Set([...a, ...b]).size
}
function similaridadeNome(a: string, b: string): number {
  return jaccard(palavrasChave(a), palavrasChave(b))
}
/** Similaridade estrutural: sobreposição do conjunto de campos (tokens). */
function similaridadeCampos(a: string[], b: string[]): number {
  return jaccard(new Set(a), new Set(b))
}

type CampoJson = {
  nome: string
  label: string
  tipo: string
  obrigatorio: boolean
  opcoes?: string[]
  placeholder?: string
}

type Historico = { role: 'user' | 'assistant'; content: string }

type Estado = 'idle' | 'analisando' | 'resultado' | 'importando'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function ParametrizarIA() {
  const [estado, setEstado] = useState<Estado>('idle')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)

  // Resultado
  const [docxBase64, setDocxBase64] = useState<string | null>(null)
  const [substituicoes, setSubstituicoes] = useState<Substituicao[]>([])
  const [camposJson, setCamposJson] = useState<CampoJson[]>([])
  const [aplicadas, setAplicadas] = useState<string[]>([])
  const [naoAplicadas, setNaoAplicadas] = useState<Array<{ original: string; token: string }>>([])
  const [historico, setHistorico] = useState<Historico[]>([])

  // Chat de edição
  const [mensagemEdit, setMensagemEdit] = useState('')
  const [editando, setEditando] = useState(false)
  const [forcando, setForcando] = useState(false)

  // Import dialog
  const [nomeImport, setNomeImport] = useState('')
  const [tipoImport, setTipoImport] = useState('')
  const [importando, setImportando] = useState(false)
  const [erroImport, setErroImport] = useState<string | null>(null)
  const [sucessoImport, setSucessoImport] = useState<{ nome: string; versao: number; substituido: boolean } | null>(null)
  const router = useRouter()
  // Detecção de versão / template parecido
  const [existentes, setExistentes] = useState<TemplateExistente[]>([])
  const [substituirTipo, setSubstituirTipo] = useState<string | null>(null)
  const [scoresTexto, setScoresTexto] = useState<Record<string, number>>({})
  const [comparando, setComparando] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  // Tokens do contrato recém-parametrizado (sinal estrutural de "mesmo contrato")
  const tokensAtuais = camposJson.map(c => c.nome).filter(Boolean)

  // Templates parecidos: combina 3 sinais —
  //  (1) TEXTO/ESTRUTURA do contrato (shingles do .docx, sinal mais forte),
  //  (2) sobreposição de CAMPOS (tokens), (3) similaridade de NOME.
  const similares = existentes
    .map(t => {
      const scoreTexto = scoresTexto[t.tipo] ?? 0
      const scoreCampos = similaridadeCampos(t.campos ?? [], tokensAtuais)
      const scoreNome = similaridadeNome(t.nome, nomeImport)
      const score = Math.max(scoreTexto, scoreCampos, scoreNome * 0.9)
      return { ...t, score, scoreTexto, scoreCampos, scoreNome }
    })
    .filter(t => t.score >= 0.35 || t.tipo === tipoImport || t.tipo === substituirTipo)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)

  function resetar() {
    setEstado('idle')
    setArquivo(null)
    setDocxBase64(null)
    setSubstituicoes([])
    setCamposJson([])
    setAplicadas([])
    setNaoAplicadas([])
    setHistorico([])
    setMensagemEdit('')
    setNomeImport('')
    setTipoImport('')
    setSubstituirTipo(null)
  }

  async function abrirImportacao() {
    // Sugere nome a partir do arquivo enviado (ajuda na detecção por nome também)
    const sugestao = arquivo
      ? arquivo.name.replace(/\.docx$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).trim()
      : ''
    setNomeImport(sugestao)
    setTipoImport(sugestao ? slugify(sugestao) : '')
    setSubstituirTipo(null)
    setScoresTexto({})
    setEstado('importando')
    // Lista os existentes (com campos) e compara TEXTO/ESTRUTURA do contrato
    try {
      const res = await fetch('/api/templates/listar')
      const data = await res.json()
      setExistentes(data.templates ?? [])
    } catch {
      setExistentes([])
    }
    if (docxBase64) {
      setComparando(true)
      try {
        const res = await fetch('/api/templates/comparar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docxBase64 }),
        })
        const data = await res.json()
        const map: Record<string, number> = {}
        for (const s of (data.scores ?? []) as Array<{ tipo: string; score: number }>) map[s.tipo] = s.score
        setScoresTexto(map)
      } catch {
        setScoresTexto({})
      } finally {
        setComparando(false)
      }
    }
  }

  function onFileSelect(f: File) {
    if (!f.name.endsWith('.docx')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione um arquivo .docx', variant: 'destructive' })
      return
    }
    setArquivo(f)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFileSelect(f)
  }, [])

  async function parametrizar(hist: Historico[], msg: string) {
    if (!arquivo) return
    setEstado(hist.length === 0 ? 'analisando' : estado)
    setEditando(hist.length > 0)

    const fd = new FormData()
    fd.append('file', arquivo)
    fd.append('historico', JSON.stringify(hist))
    fd.append('mensagem', msg)

    try {
      const res = await fetch('/api/templates/parametrizar', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro desconhecido')

      setDocxBase64(data.docxBase64)
      setSubstituicoes(data.substituicoes ?? [])
      setCamposJson(data.campos_json ?? [])
      setAplicadas(data.aplicadas ?? [])
      setNaoAplicadas(data.naoAplicadas ?? [])
      setHistorico(data.historico ?? [])
      setEstado('resultado')

      if (data.naoAplicadas?.length > 0) {
        toast({
          title: `${data.naoAplicadas.length} substituição(ões) pendente(s)`,
          description: 'Use o chat abaixo para pedir ao Claude que ajuste os campos não aplicados.',
          variant: 'default',
        })
      }
    } catch (e: any) {
      toast({ title: 'Erro na parametrização', description: e.message, variant: 'destructive' })
      if (hist.length === 0) setEstado('idle')
    } finally {
      setEditando(false)
    }
  }

  async function enviarEdit() {
    if (!mensagemEdit.trim()) return
    const msg = mensagemEdit.trim()
    setMensagemEdit('')
    await parametrizar(historico, msg)
  }

  async function forcarAplicacao() {
    if (!docxBase64 || naoAplicadas.length === 0) return
    setForcando(true)
    try {
      const res = await fetch('/api/templates/forcar-substituicao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docxBase64, substituicoes: naoAplicadas }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao forçar aplicação')

      setDocxBase64(data.docxBase64)
      const novasAplicadas: string[] = data.aplicadas ?? []
      setAplicadas(prev => Array.from(new Set([...prev, ...novasAplicadas])))
      setNaoAplicadas(data.naoAplicadas ?? [])

      if (novasAplicadas.length > 0) {
        toast({
          title: `${novasAplicadas.length} substituição(ões) aplicada(s)`,
          description: data.naoAplicadas?.length
            ? `Ainda restam ${data.naoAplicadas.length} sem localização. Tente um trecho menor pelo chat.`
            : 'Todos os campos pendentes foram aplicados.',
        })
      } else {
        toast({
          title: 'Não foi possível localizar os trechos',
          description: 'Use o chat abaixo e peça ao Claude um trecho menor (ex: só parte do nome ou CPF).',
          variant: 'destructive',
        })
      }
    } catch (e: any) {
      toast({ title: 'Erro ao forçar aplicação', description: e.message, variant: 'destructive' })
    } finally {
      setForcando(false)
    }
  }

  function baixarDocx() {
    if (!docxBase64 || !arquivo) return
    const bytes = Uint8Array.from(atob(docxBase64), c => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `parametrizado_${arquivo.name}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function importar() {
    // Se for substituição, usa o tipo do template anterior; senão o tipo digitado
    const tipoFinal = substituirTipo ?? tipoImport
    if (!nomeImport.trim() || !tipoFinal.trim() || !docxBase64) return
    setImportando(true)
    setErroImport(null)
    try {
      const res = await fetch('/api/templates/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeImport, tipo: tipoFinal, docxBase64, campos_json: camposJson }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`)
      // Popup de confirmação + orientação (o refresh acontece ao fechar o popup,
      // para não re-renderizar a página e atropelar a confirmação)
      setSucessoImport({ nome: nomeImport, versao: data.versao ?? 1, substituido: !!data.substituido })
    } catch (e: any) {
      setErroImport(e.message ?? 'Falha ao importar')
      toast({ title: 'Erro ao importar', description: e.message, variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  // ── Sucesso: confirmação inline (prioridade sobre qualquer estado) ──
  if (sucessoImport) {
    return (
      <div className="border-2 border-green-300 bg-green-50 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
          <p className="text-lg font-heading font-semibold text-green-800">
            {sucessoImport.substituido ? 'Template atualizado com sucesso!' : 'Template importado com sucesso!'}
          </p>
        </div>
        <p className="text-sm text-nex-gray-700 leading-relaxed">
          <strong>{sucessoImport.nome}</strong> foi salvo no sistema
          {sucessoImport.substituido ? ` como nova versão (v${sucessoImport.versao})` : ''}.
        </p>
        <div className="px-4 py-3 bg-white border border-green-200 rounded-lg space-y-1.5">
          <p className="text-xs font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Próximos passos</p>
          <p className="text-xs text-nex-gray-600 leading-relaxed">
            1. O template já aparece na aba <strong>Documentos</strong> aqui em cima (lista atualizada automaticamente).<br />
            2. Para gerar contratos com ele, vá em <strong>Novo Contrato</strong> → categoria <strong>Personalizados</strong>.
          </p>
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={() => { setSucessoImport(null); resetar(); router.refresh() }}>
            Importar outro
          </Button>
          <Button className="flex-1 gap-1.5" onClick={() => { setSucessoImport(null); resetar(); router.push('/contratos/novo') }}>
            Ir para Novo Contrato
          </Button>
        </div>
      </div>
    )
  }

  // ── Idle: área de upload ──
  if (estado === 'idle') {
    return (
      <div className="space-y-4">
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            dragging ? 'border-nex-black bg-nex-gray-50' : 'border-nex-gray-200 hover:border-nex-gray-400 hover:bg-nex-gray-50'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f) }}
          />
          <Upload className="w-8 h-8 mx-auto mb-3 text-nex-gray-300" />
          <p className="text-sm font-semibold text-nex-gray-600">Arraste um contrato .docx aqui</p>
          <p className="text-xs text-nex-gray-400 mt-1">ou clique para selecionar o arquivo</p>
        </div>

        {arquivo && (
          <div className="flex items-center justify-between bg-nex-gray-50 border border-nex-gray-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-nex-gray-500" />
              <span className="text-sm font-semibold text-nex-gray-700 truncate max-w-[260px]">{arquivo.name}</span>
              <span className="text-xs text-nex-gray-400">({(arquivo.size / 1024).toFixed(0)} KB)</span>
            </div>
            <Button
              onClick={() => parametrizar([], '')}
              className="gap-2 ml-4"
              size="sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Parametrizar com Claude
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ── Analisando ──
  if (estado === 'analisando') {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-nex-black" />
        <div className="text-center">
          <p className="text-sm font-semibold text-nex-gray-700">Claude está analisando o contrato…</p>
          <p className="text-xs text-nex-gray-400 mt-1">Pode levar até 30 segundos</p>
        </div>
      </div>
    )
  }

  // ── Resultado + chat ──
  if (estado === 'resultado' || (estado === 'importando' && !importando)) {
    return (
      <div className="space-y-4">
        {/* Header com arquivo e botões */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-nex-gray-500" />
            <span className="text-sm font-semibold text-nex-gray-700">{arquivo?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={baixarDocx}>
              <Download className="w-3.5 h-3.5" /> Baixar preview
            </Button>
            <button onClick={resetar} className="p-1 text-nex-gray-400 hover:text-nex-gray-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Aviso de não aplicadas */}
        {naoAplicadas.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-800">
                {naoAplicadas.length} substituição(ões) não aplicada(s) — texto fragmentado no Word
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Use o chat abaixo e peça ao Claude para tentar um trecho menor (ex: só parte do nome ou CPF)
              </p>
              <ul className="mt-1 space-y-0.5">
                {naoAplicadas.map((n, i) => (
                  <li key={i} className="text-xs text-amber-700 font-mono">
                    <span className="font-bold">{`{{${n.token}}}`}</span> — &quot;{n.original.slice(0, 50)}&quot;
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 bg-white"
                  onClick={forcarAplicacao}
                  disabled={forcando}
                >
                  {forcando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Aplicar mesmo assim
                </Button>
                <p className="text-[11px] text-amber-700">
                  Confirma que esses campos são esses parâmetros e aplica mesmo com o texto fragmentado no Word.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Lista de tokens */}
        <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-nex-gray-100 flex items-center justify-between">
            <p className="text-xs font-heading font-semibold uppercase tracking-widest text-nex-gray-400">
              Marcadores aplicados ({aplicadas.length})
            </p>
            <span className="text-xs text-nex-gray-400">{substituicoes.length} total identificado(s)</span>
          </div>
          <div className="divide-y divide-nex-gray-100 max-h-72 overflow-y-auto">
            {substituicoes.map((s, i) => {
              const ok = aplicadas.includes(s.token)
              return (
                <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                  {ok
                    ? <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  }
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono font-bold text-nex-black">{`{{${s.token}}}`}</span>
                      <ChevronRight className="w-3 h-3 text-nex-gray-300" />
                      <span className="text-xs text-nex-gray-500 truncate">{s.original}</span>
                    </div>
                    {s.contexto && (
                      <p className="text-xs text-nex-gray-400 italic truncate">{s.contexto}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Campos do formulário */}
        {camposJson.length > 0 && (
          <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-nex-gray-100">
              <p className="text-xs font-heading font-semibold uppercase tracking-widest text-nex-gray-400">
                Campos do formulário ({camposJson.length})
              </p>
            </div>
            <div className="divide-y divide-nex-gray-100 max-h-48 overflow-y-auto">
              {camposJson.map((c, i) => (
                <div key={i} className="px-4 py-2 flex items-center gap-3">
                  <span className="text-xs font-mono text-nex-gray-600 w-36 flex-shrink-0">{c.nome}</span>
                  <span className="text-xs font-semibold text-nex-black flex-1">{c.label}</span>
                  <span className="text-xs text-nex-gray-400">{c.tipo}</span>
                  {c.obrigatorio && <span className="text-[10px] text-red-400 font-bold">*</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat de edição */}
        <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-nex-gray-100 flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-nex-gray-400" />
            <p className="text-xs font-heading font-semibold uppercase tracking-widest text-nex-gray-400">
              Pedir ajuste ao Claude
            </p>
          </div>
          <div className="p-3 flex gap-2">
            <Input
              value={mensagemEdit}
              onChange={e => setMensagemEdit(e.target.value)}
              placeholder='Ex: "renomeie data para data_assinatura" ou "o CPF não foi aplicado, tente sem pontuação"'
              className="text-sm"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarEdit() } }}
              disabled={editando}
            />
            <Button onClick={enviarEdit} disabled={editando || !mensagemEdit.trim()} size="sm" className="gap-1.5 flex-shrink-0">
              {editando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Enviar
            </Button>
          </div>
        </div>

        {/* Importar para Novo Contrato */}
        {estado !== 'importando' ? (
          <div className="flex justify-end">
            <Button onClick={abrirImportacao} className="gap-2">
              <Check className="w-4 h-4" />
              Importar para Novo Contrato
            </Button>
          </div>
        ) : null}
      </div>
    )
  }

  // ── Importando: dialog ──
  if (estado === 'importando') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-heading font-semibold text-nex-black">Importar template para o sistema</p>
          <button onClick={() => setEstado('resultado')} className="p-1 text-nex-gray-400 hover:text-nex-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white border border-nex-gray-200 rounded-xl p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">
              Nome do template *
            </label>
            <Input
              value={nomeImport}
              onChange={e => {
                setNomeImport(e.target.value)
                if (!tipoImport) setTipoImport(slugify(e.target.value))
              }}
              placeholder="Ex: Contrato Especial Franquias"
            />
          </div>

          {/* Identificador só é relevante quando NÃO é substituição */}
          {!substituirTipo && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">
                Identificador único (tipo) *
              </label>
              <Input
                value={tipoImport}
                onChange={e => setTipoImport(slugify(e.target.value))}
                placeholder="contrato_especial_franquias"
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-nex-gray-400">
                snake_case — letras minúsculas, números e underscore. Usado internamente pelo sistema.
              </p>
            </div>
          )}

          {/* Comparando estrutura/texto do contrato */}
          {comparando && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-nex-gray-50 border border-nex-gray-200 rounded-lg">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-nex-gray-400" />
              <p className="text-xs text-nex-gray-500">Comparando estrutura e texto com os contratos já cadastrados…</p>
            </div>
          )}

          {/* Detecção de template parecido / nova versão */}
          {!comparando && similares.length > 0 && (
            <div className="px-3.5 py-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2.5">
              <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Este contrato parece muito similar a {similares.length === 1 ? 'um já cadastrado' : 'contratos já cadastrados'} — é uma nova versão?
              </p>
              <div className="space-y-1.5">
                {similares.map(s => {
                  const escolhido = substituirTipo === s.tipo
                  const pct = Math.round(s.score * 100)
                  return (
                    <div key={s.tipo} className={cn(
                      'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 bg-white',
                      escolhido ? 'border-nex-black' : 'border-amber-200'
                    )}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-nex-black truncate">{s.nome}</p>
                          {pct > 0 && (
                            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0',
                              pct >= 80 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-nex-gray-100 text-nex-gray-500')}>
                              {pct}% similar
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-nex-gray-400 font-mono">{s.tipo} · versão atual v{s.versao}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={escolhido ? 'default' : 'outline'}
                        className="gap-1.5 flex-shrink-0 h-7 text-xs"
                        onClick={() => {
                          if (escolhido) { setSubstituirTipo(null) }
                          else { setSubstituirTipo(s.tipo); setNomeImport(s.nome) }
                        }}
                      >
                        {escolhido ? <><Check className="w-3 h-3" /> Sim, substituir (v{s.versao + 1})</> : <><RefreshCw className="w-3 h-3" /> Substituir esta</>}
                      </Button>
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  onClick={() => setSubstituirTipo(null)}
                  className={cn('flex items-center gap-1 text-[11px] font-semibold transition-colors',
                    substituirTipo ? 'text-nex-gray-400 hover:text-nex-black' : 'text-nex-black')}
                >
                  <Plus className="w-3 h-3" /> Não, subir como template novo
                </button>
              </div>
            </div>
          )}

          <div className="px-3 py-2.5 bg-nex-gray-50 rounded-lg">
            {substituirTipo ? (
              <p className="text-xs font-bold text-nex-gray-600">
                Vai <strong>substituir</strong> o template <span className="font-mono">{substituirTipo}</span> por uma nova versão, mantendo-o em Novo Contrato.
              </p>
            ) : (
              <>
                <p className="text-xs font-bold text-nex-gray-600">
                  {camposJson.length} campo(s) serão criados no formulário de Novo Contrato
                </p>
                <p className="text-xs text-nex-gray-400 mt-0.5">
                  O template aparecerá na aba <strong>Personalizados</strong> em Novo Contrato
                </p>
              </>
            )}
          </div>

          {/* Confirma que a comparação rodou e não achou parecido */}
          {!comparando && !substituirTipo && similares.length === 0 && existentes.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-nex-gray-50 border border-nex-gray-200 rounded-lg">
              <Check className="w-3.5 h-3.5 text-nex-gray-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-nex-gray-500">
                Comparei estrutura e texto com os {existentes.length} contrato(s) cadastrado(s) e não encontrei
                um parecido — este será criado como <strong>template novo</strong>.
              </p>
            </div>
          )}

          {/* Pendências não bloqueiam a importação */}
          {naoAplicadas.length > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Há <strong>{naoAplicadas.length} campo(s) ainda não aplicado(s)</strong>. Você pode
                importar mesmo assim — o template é salvo como está e você ajusta os campos restantes
                depois pelo editor de templates. A importação não fica bloqueada.
              </p>
            </div>
          )}

          {erroImport && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-red-700">{erroImport}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => { setErroImport(null); setEstado('resultado') }} className="flex-1">
              Voltar
            </Button>
            <Button
              onClick={importar}
              disabled={importando || !nomeImport.trim() || (!substituirTipo && !tipoImport.trim())}
              className="flex-1 gap-2"
            >
              {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {importando ? 'Importando…' : substituirTipo ? 'Substituir template' : naoAplicadas.length > 0 ? 'Importar mesmo assim' : 'Confirmar importação'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
