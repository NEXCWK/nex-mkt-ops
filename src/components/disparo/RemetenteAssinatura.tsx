'use client'

import { useEffect, useState } from 'react'
import { REMETENTES_DISPARO } from '@/lib/remetentes'
import { Upload, Trash2, Loader2 } from 'lucide-react'

interface Props {
  remetente: string
  onChangeRemetente: (email: string) => void
}

/** Seletor de remetente + assinatura (imagem de rodapé) para disparos em massa — compartilhado por BDR, Parcerias e CCO. */
export function RemetenteAssinatura({ remetente, onChangeRemetente }: Props) {
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setCarregando(true)
    setErro(null)
    fetch(`/api/disparo/assinatura?remetente=${encodeURIComponent(remetente)}`)
      .then(r => r.json())
      .then(json => { if (!cancelado) setAssinaturaUrl(json.url ?? null) })
      .catch(() => { if (!cancelado) setAssinaturaUrl(null) })
      .finally(() => { if (!cancelado) setCarregando(false) })
    return () => { cancelado = true }
  }, [remetente])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEnviando(true)
    setErro(null)
    try {
      const form = new FormData()
      form.append('remetente', remetente)
      form.append('file', file)
      const res = await fetch('/api/disparo/assinatura', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Falha ao enviar a assinatura')
      setAssinaturaUrl(json.url)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao enviar a assinatura')
    } finally {
      setEnviando(false)
      e.target.value = ''
    }
  }

  async function remover() {
    setEnviando(true)
    try {
      await fetch(`/api/disparo/assinatura?remetente=${encodeURIComponent(remetente)}`, { method: 'DELETE' })
      setAssinaturaUrl(null)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Remetente</label>
        <select value={remetente} onChange={e => onChangeRemetente(e.target.value)}
          className="rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400">
          {REMETENTES_DISPARO.map(r => (
            <option key={r.email} value={r.email}>{r.nome} · {r.email}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Assinatura (rodapé do e-mail)</label>
        <div className="flex items-center gap-2">
          {carregando ? (
            <Loader2 className="w-4 h-4 animate-spin text-nex-gray-300" />
          ) : assinaturaUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assinaturaUrl} alt="Assinatura" className="h-9 max-w-[160px] object-contain rounded border border-nex-gray-200 bg-white" />
              <button onClick={remover} disabled={enviando} title="Remover assinatura"
                className="p-1.5 text-nex-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40">
                {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </>
          ) : (
            <label className={`flex items-center gap-1.5 text-xs text-nex-gray-500 hover:text-nex-black cursor-pointer border border-dashed border-nex-gray-300 rounded-lg px-3 py-1.5 ${enviando ? 'opacity-50 pointer-events-none' : ''}`}>
              {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Enviar .png
              <input type="file" accept="image/png" onChange={onFile} className="hidden" disabled={enviando} />
            </label>
          )}
        </div>
        {erro && <p className="text-[11px] text-red-600 mt-1">{erro}</p>}
      </div>
    </div>
  )
}
