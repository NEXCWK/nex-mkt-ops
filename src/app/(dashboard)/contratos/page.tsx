import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'

async function getDocumentos() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('documentos_gerados')
    .select('*, clientes(nome)')
    .order('created_at', { ascending: false })
    .limit(50)
  return data ?? []
}

export default async function ContratosPage() {
  const documentos = await getDocumentos()

  return (
    <div>
      <PageHeader
        title="Contratos"
        description="Histórico de contratos e termos gerados."
        actions={
          <Button variant="primary" asChild>
            <Link href="/contratos/novo">
              <Plus className="h-4 w-4" />
              Novo Contrato
            </Link>
          </Button>
        }
      />

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-nex-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Cliente</th>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Operador</th>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Data</th>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Drive</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nex-gray-100">
            {documentos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-nex-gray-400">
                  Nenhum documento gerado ainda.
                </td>
              </tr>
            )}
            {documentos.map((doc: any) => (
              <tr key={doc.id} className="hover:bg-nex-gray-50">
                <td className="px-4 py-3">
                  <Badge variant="secondary">{doc.tipo?.replace(/_/g, ' ')}</Badge>
                </td>
                <td className="px-4 py-3 font-medium">{doc.clientes?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-nex-gray-500">{doc.operador_email}</td>
                <td className="px-4 py-3 text-nex-gray-500">{formatDateTime(doc.created_at)}</td>
                <td className="px-4 py-3">
                  {doc.drive_url ? (
                    <a href={doc.drive_url} target="_blank" rel="noreferrer" className="text-nex-black hover:text-nex-yellow inline-flex items-center gap-1">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver
                    </a>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
