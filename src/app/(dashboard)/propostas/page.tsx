import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function PropostasPage() {
  return (
    <div>
      <PageHeader
        title="Propostas"
        description="Gere propostas comerciais em .pptx."
        actions={
          <Button variant="primary" asChild>
            <Link href="/propostas/nova">
              <Plus className="h-4 w-4" />
              Nova Proposta
            </Link>
          </Button>
        }
      />
      <div className="bg-white border rounded-lg p-8 text-center text-nex-gray-400 text-sm">
        Histórico de propostas geradas aparecerá aqui.
      </div>
    </div>
  )
}
