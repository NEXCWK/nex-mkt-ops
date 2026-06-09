import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { ExternalLink, Download, FileText } from 'lucide-react'

async function getHistorico() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('documentos_gerados')
    .select('*, clientes(nome), templates_documentos(nome)')
    .order('created_at', { ascending: false })
    .limit(100)
  return data ?? []
}

export default async function HistoricoPage() {
  const docs = await getHistorico()

  return (
    <div>
      <PageHeader
        title="Histórico de Documentos"
        description="Todos os contratos, termos e propostas gerados."
      />

      <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-nex-gray-50 border-b border-nex-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Tipo</th>
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Cliente</th>
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Template</th>
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Operador</th>
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Gerado em</th>
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nex-gray-100">
              {docs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-14">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <FileText className="w-6 h-6 text-nex-gray-300" />
                      <p className="text-sm text-nex-gray-400">Nenhum documento gerado ainda.</p>
                      <Link href="/contratos/novo" className="text-xs text-nex-gray-500 underline underline-offset-2 hover:text-nex-black transition-colors">
                        Gerar o primeiro contrato
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
              {docs.map((doc: any) => (
                <tr key={doc.id} className="hover:bg-nex-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{doc.tipo?.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium">{doc.clientes?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-nex-gray-500">{doc.templates_documentos?.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-nex-gray-500">{doc.operador_email}</td>
                  <td className="px-4 py-3 text-nex-gray-500 whitespace-nowrap">{formatDateTime(doc.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {doc.arquivo_url && (
                        <a href={doc.arquivo_url} download title="Baixar .docx" className="text-nex-gray-400 hover:text-nex-black transition-colors">
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      {doc.drive_url && (
                        <a href={doc.drive_url} target="_blank" rel="noreferrer" title="Abrir no Drive" className="text-nex-gray-400 hover:text-nex-black transition-colors">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
