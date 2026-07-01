'use client'

import { useEffect, useState } from 'react'
import { Upload, Plus, X, Loader2 } from 'lucide-react'

interface Modelo {
  id: string
  nome: string
  html: string | null
  css: string | null
  js: string | null
}

interface Props {
  contexto: 'lp' | 'criativo'
  modeloId: string
  onChange: (id: string) => void
}

async function lerArquivo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = reject
    reader.readAsText(file)
  })
}

export function ModeloReferenciaPicker({ contexto, modeloId, onChange }: Props) {
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [carregando, setCarregando] = useState(false)
  const [abrirUpload, setAbrirUpload] = useState(false)
  const [nome, setNome] = useState('')
  const [html, setHtml] = useState('')
  const [css, setCss] = useState('')
  const [js, setJs] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    setCarregando(true)
    try {
      const res = await fetch(`/api/modelos-referencia?contexto=${contexto}`)
      const json = await res.json()
      setModelos(json.modelos ?? [])
    } catch {
      setModelos([])
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [contexto]) // eslint-disable-line react-hooks/exhaustive-deps

  async function onFile(campo: 'html' | 'css' | 'js', file: File | undefined) {
    if (!file) return
    const texto = await lerArquivo(file)
    if (campo === 'html') setHtml(texto)
    if (campo === 'css') setCss(texto)
    if (campo === 'js') setJs(texto)
  }

  async function enviarModelo() {
    if (!nome.trim() || (!html.trim() && !css.trim() && !js.trim()) || enviando) return
    setEnviando(true)
    setErro(null)
    try {
      const res = await fetch('/api/modelos-referencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contexto, nome, html, css, js }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      await carregar()
      onChange(json.modelo.id)
      setAbrirUpload(false)
      setNome(''); setHtml(''); setCss(''); setJs('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar modelo')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div>
      <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1.5">Modelo de referência (opcional)</label>
      <div className="flex items-center gap-2">
        <select value={modeloId} onChange={e => onChange(e.target.value)} disabled={carregando}
          className="flex-1 rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400">
          <option value="">Nenhum (a IA usa o padrão Nex)</option>
          {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <button type="button" onClick={() => setAbrirUpload(v => !v)}
          className="flex items-center gap-1 px-3 py-2 rounded-lg border border-nex-gray-200 text-xs text-nex-gray-500 hover:bg-nex-gray-50 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Novo
        </button>
      </div>

      {abrirUpload && (
        <div className="mt-3 p-3 rounded-lg border border-nex-gray-200 bg-nex-gray-50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-heading font-semibold text-nex-gray-700">Enviar modelo de referência</span>
            <button onClick={() => setAbrirUpload(false)} className="text-nex-gray-400 hover:text-nex-black"><X className="w-3.5 h-3.5" /></button>
          </div>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do modelo"
            className="w-full rounded-md border border-nex-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          <div className="grid grid-cols-3 gap-2">
            {(['html', 'css', 'js'] as const).map(campo => (
              <label key={campo} className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-dashed border-nex-gray-300 text-[11px] text-nex-gray-500 hover:border-nex-gray-400 cursor-pointer">
                <Upload className="w-3 h-3" /> .{campo}
                <input type="file" accept={`.${campo}`} className="hidden"
                  onChange={e => onFile(campo, e.target.files?.[0])} />
              </label>
            ))}
          </div>
          <p className="text-[10px] text-nex-gray-400">
            {html && 'HTML carregado. '}{css && 'CSS carregado. '}{js && 'JS carregado.'}
          </p>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <button onClick={enviarModelo} disabled={enviando || !nome.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-nex-black text-white text-xs font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 transition-colors">
            {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Salvar modelo
          </button>
        </div>
      )}
    </div>
  )
}
