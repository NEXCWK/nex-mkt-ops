'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/hooks/use-toast'
import { Trash2, Loader2, Check, X } from 'lucide-react'

export function ExcluirTemplateButton({ tipo, nome }: { tipo: string; nome: string }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  async function excluir() {
    setExcluindo(true)
    try {
      const res = await fetch('/api/templates/excluir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao excluir')
      toast({ title: 'Template excluído', description: `"${nome}" foi removido do sistema.` })
      router.refresh()
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' })
      setExcluindo(false)
      setConfirmando(false)
    }
  }

  if (confirmando) {
    return (
      <div className="flex items-center gap-1.5 justify-end">
        <span className="text-[11px] text-nex-gray-500">Excluir?</span>
        <button
          onClick={excluir}
          disabled={excluindo}
          className="p-1 rounded text-red-600 hover:bg-red-50 transition-colors"
          title="Confirmar exclusão"
        >
          {excluindo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => setConfirmando(false)}
          disabled={excluindo}
          className="p-1 rounded text-nex-gray-400 hover:bg-nex-gray-100 transition-colors"
          title="Cancelar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirmando(true)}
      className="p-1 rounded text-nex-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors"
      title="Excluir template"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  )
}
