'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type SeedResult = { tipo: string; status: string; detail?: string }

export function SeedTemplatesButton() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ ok: number; total: number; results: SeedResult[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSeed() {
    if (!confirm('Isso vai fazer upload dos 13 templates para o Supabase Storage e registrá-los no banco. Continuar?')) return
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      const res = await fetch('/api/admin/seed-templates', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro desconhecido')
      } else {
        setResults(data)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={handleSeed} disabled={loading} variant="outline">
        {loading ? 'Importando...' : 'Importar Templates (.docx)'}
      </Button>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      {results && (
        <div className="text-sm bg-green-50 border border-green-200 rounded p-3 space-y-1">
          <p className="font-semibold text-green-800">
            {results.ok} de {results.total} templates importados com sucesso.
          </p>
          {results.results.filter(r => r.status !== 'ok').map(r => (
            <p key={r.tipo} className="text-orange-700">
              ⚠ {r.tipo}: {r.status}{r.detail ? ` — ${r.detail}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
