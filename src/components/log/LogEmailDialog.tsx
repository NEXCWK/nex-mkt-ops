'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Eye } from 'lucide-react'

export function LogEmailDialog({ log }: { log: any }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Eye className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>E-mail enviado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2 p-3 bg-nex-gray-50 rounded text-xs">
              <div><span className="text-nex-gray-500">Para:</span> {log.destinatario}</div>
              <div><span className="text-nex-gray-500">Operador:</span> {log.operador_email}</div>
              <div><span className="text-nex-gray-500">Cópias:</span> {Array.isArray(log.copia_json) ? log.copia_json.join(', ') : '—'}</div>
              <div><span className="text-nex-gray-500">Enviado:</span> {new Date(log.sent_at).toLocaleString('pt-BR')}</div>
            </div>
            <div>
              <p className="font-medium mb-2">Corpo do e-mail:</p>
              <pre className="whitespace-pre-wrap font-body text-sm p-4 border rounded bg-white max-h-[50vh] overflow-y-auto">
                {log.corpo_final ?? ''}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
