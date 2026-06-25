'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type SeedResult = { tipo: string; status: string; detail?: string }
type SeedResponse = { ok: number; skipped: number; total: number; results: SeedResult[] }

export function SeedTemplatesButton() {
  const router = useRouter()
  const [loading, setLoading] = useState<'novos' | 'todos' | null>(null)
  const [results, setResults] = useState<SeedResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSeed(force: boolean) {
    if (force && !confirm('Isso vai reimportar TODOS os templates, sobrescrevendo os arquivos já existentes no Supabase. Continuar?')) return
    setLoading(force ? 'todos' : 'novos')
    setError(null)
    setResults(null)
    try {
      const url = force ? '/api/admin/seed-templates?force=true' : '/api/admin/seed-templates'
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro desconhecido')
      } else {
        setResults(data)
        // Atualiza a listagem e as contagens sem precisar de F5
        router.refresh()
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => handleSeed(false)} disabled={loading !== null} variant="outline">
          {loading === 'novos' ? 'Importando...' : 'Importar Templates Novos'}
        </Button>
        <Button onClick={() => handleSeed(true)} disabled={loading !== null} variant="ghost">
          {loading === 'todos' ? 'Reimportando...' : 'Reimportar Todos'}
        </Button>
      </div>

      <p className="text-xs text-nex-gray-400">
        &ldquo;Importar Templates Novos&rdquo; envia apenas os modelos ainda não importados.
        Use &ldquo;Reimportar Todos&rdquo; somente para atualizar arquivos já existentes.
      </p>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      {results && (
        <div className="text-sm bg-green-50 border border-green-200 rounded p-3 space-y-1">
          <p className="font-semibold text-green-800">
            {results.ok} importado{results.ok === 1 ? '' : 's'}
            {results.skipped > 0 && `, ${results.skipped} já existia${results.skipped === 1 ? '' : 'm'}`}
            {' '}(de {results.total} no total).
          </p>
          {results.results.filter(r => r.status !== 'ok' && r.status !== 'skipped').map(r => (
            <p key={r.tipo} className="text-orange-700">
              ⚠ {r.tipo}: {r.status}{r.detail ? ` — ${r.detail}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
