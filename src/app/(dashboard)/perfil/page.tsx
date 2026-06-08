'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Upload, Trash2, Check } from 'lucide-react'
import Image from 'next/image'

export default function PerfilPage() {
  const { data: session } = useSession()
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/usuario/perfil')
      .then(r => r.json())
      .then(d => { setAssinaturaUrl(d.assinatura_url ?? null); setLoading(false) })
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/usuario/assinatura', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setAssinaturaUrl(data.url)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!confirm('Remover a assinatura?')) return
    setRemoving(true)
    try {
      await fetch('/api/usuario/assinatura', { method: 'DELETE' })
      setAssinaturaUrl(null)
    } finally { setRemoving(false) }
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Meu Perfil" description="Gerencie sua assinatura de e-mail." />

      {/* Info */}
      <div className="bg-white border border-nex-gray-200 rounded-xl p-5 mb-4">
        <p className="text-xs font-black uppercase tracking-widest text-nex-gray-400 mb-3">Conta</p>
        <div className="space-y-1.5">
          <div className="flex gap-3">
            <span className="text-xs font-extrabold text-nex-gray-400 w-16">Nome</span>
            <span className="text-sm font-bold text-nex-black">{session?.user?.name ?? '—'}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-xs font-extrabold text-nex-gray-400 w-16">E-mail</span>
            <span className="text-sm font-bold text-nex-black">{session?.user?.email ?? '—'}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-xs font-extrabold text-nex-gray-400 w-16">Perfil</span>
            <span className="text-sm font-bold text-nex-black capitalize">{session?.user?.perfil ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Assinatura */}
      <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-nex-gray-100">
          <p className="text-xs font-black uppercase tracking-widest text-nex-gray-400">Assinatura de E-mail</p>
          <p className="text-xs font-bold text-nex-gray-400 mt-0.5">
            Imagem inserida automaticamente ao final de todos os e-mails gerados.
            Formatos aceitos: PNG, JPG. Recomendado: fundo transparente.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="h-20 rounded-lg bg-nex-gray-50 animate-pulse" />
          ) : assinaturaUrl ? (
            <div className="space-y-3">
              <div className="p-4 bg-nex-gray-50 border border-nex-gray-200 rounded-lg flex items-center justify-center min-h-[80px]">
                <Image
                  src={assinaturaUrl}
                  alt="Assinatura"
                  width={400}
                  height={120}
                  style={{ maxHeight: 120, width: 'auto', objectFit: 'contain' }}
                  unoptimized
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? 'Enviando...' : 'Substituir'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRemove}
                  disabled={removing}
                  className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {removing ? 'Removendo...' : 'Remover'}
                </Button>
                {saved && (
                  <span className="flex items-center gap-1 text-xs font-extrabold text-green-600">
                    <Check className="w-3.5 h-3.5" /> Salvo!
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-nex-gray-200 rounded-xl py-10 flex flex-col items-center gap-2 hover:border-nex-gray-400 hover:bg-nex-gray-50 transition-colors"
              >
                <Upload className="w-5 h-5 text-nex-gray-400" />
                <span className="text-sm font-extrabold text-nex-gray-400">
                  {uploading ? 'Enviando...' : 'Clique para fazer upload da assinatura'}
                </span>
                <span className="text-xs font-bold text-nex-gray-300">PNG, JPG ou WebP · máx. 2 MB</span>
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>
    </div>
  )
}
