'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { Settings } from 'lucide-react'
import type { Espaco } from '@/types'

export function EspacoActions({ espaco }: { espaco: Espaco }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [churnSinalizado, setChurnSinalizado] = useState(espaco.churn_sinalizado)
  const [churnData, setChurnData] = useState(espaco.churn_data ?? '')
  const [loading, setLoading] = useState(false)

  async function handleSalvar() {
    if (churnSinalizado && !churnData) {
      toast({ title: 'Data obrigatória', description: 'Informe a data de disponibilidade.', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/espacos/${espaco.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ churn_sinalizado: churnSinalizado, churn_data: churnSinalizado ? churnData : null }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      toast({ title: 'Salvo!', description: 'Informações atualizadas.', variant: 'default' })
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <Settings className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{espaco.nome}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <Checkbox
                id="churn"
                checked={churnSinalizado}
                onCheckedChange={v => setChurnSinalizado(!!v)}
              />
              <Label htmlFor="churn" className="cursor-pointer">Churn Sinalizado</Label>
            </div>

            {churnSinalizado && (
              <div className="space-y-2">
                <Label>Data de Disponibilidade *</Label>
                <Input
                  type="date"
                  value={churnData}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setChurnData(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSalvar} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
