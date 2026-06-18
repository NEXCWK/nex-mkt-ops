'use client'
import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import {
  Sparkles, Upload, Download, Check, AlertTriangle,
  MessageSquare, Loader2, FileText, X, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Substituicao = {
  original: string
  token: string
  contexto?: string
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

  // Import dialog
  const [nomeImport, setNomeImport] = useState('')
  const [tipoImport, setTipoImport] = useState('')
  const [importando, setImportando] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

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
    if (!nomeImport.trim() || !tipoImport.trim() || !docxBase64) return
    setImportando(true)
    try {
      const res = await fetch('/api/templates/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeImport, tipo: tipoImport, docxBase64, campos_json: camposJson }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Template importado!', description: `"${nomeImport}" já está disponível em Novo Contrato.` })
      resetar()
    } catch (e: any) {
      toast({ title: 'Erro ao importar', description: e.message, variant: 'destructive' })
    } finally {
      setImportando(false)
    }
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
            <Button
              onClick={() => {
                setNomeImport('')
                setTipoImport('')
                setEstado('importando')
              }}
              className="gap-2"
            >
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

          <div className="px-3 py-2.5 bg-nex-gray-50 rounded-lg">
            <p className="text-xs font-bold text-nex-gray-600">
              {camposJson.length} campo(s) serão criados no formulário de Novo Contrato
            </p>
            <p className="text-xs text-nex-gray-400 mt-0.5">
              O template aparecerá na aba <strong>Personalizados</strong> em Novo Contrato
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setEstado('resultado')} className="flex-1">
              Voltar
            </Button>
            <Button
              onClick={importar}
              disabled={importando || !nomeImport.trim() || !tipoImport.trim()}
              className="flex-1 gap-2"
            >
              {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {importando ? 'Importando…' : 'Confirmar importação'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
