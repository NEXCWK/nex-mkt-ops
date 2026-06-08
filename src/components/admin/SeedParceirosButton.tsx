'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function SeedParceirosButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handle() {
    if (!confirm('Isso vai inserir os 7 parceiros padrão no banco. Continuar?')) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/seed-parceiros', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setResult(`Erro: ${data.error}`)
      } else {
        const ok = data.results.filter((r: any) => r.status === 'ok').length
        setResult(`${ok} de ${data.total} parceiros inseridos.`)
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handle} disabled={loading} variant="outline" size="sm">
        {loading ? 'Inserindo…' : 'Inserir Parceiros Padrão'}
      </Button>
      {result && <p className="text-sm text-nex-gray-600">{result}</p>}
    </div>
  )
}
