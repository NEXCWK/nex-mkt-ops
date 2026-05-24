'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

export function UsuarioActions({ usuario }: { usuario: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggleAtivo() {
    setLoading(true)
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !usuario.ativo }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
      toast({ title: usuario.ativo ? 'Usuário desativado' : 'Usuário ativado', variant: 'default' })
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={toggleAtivo} disabled={loading}>
      {loading ? '...' : usuario.ativo ? 'Desativar' : 'Ativar'}
    </Button>
  )
}
