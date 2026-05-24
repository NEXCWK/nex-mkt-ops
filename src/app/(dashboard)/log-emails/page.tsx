import { createServerClient } from '@/lib/supabase/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { LogEmailDialog } from '@/components/log/LogEmailDialog'

async function getLogs() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('emails_enviados')
    .select('*, clientes(nome), templates_email(nome)')
    .order('sent_at', { ascending: false })
    .limit(200)
  return data ?? []
}

export default async function LogEmailsPage() {
  const session = await getServerSession(authOptions)
  if (!session || !['gestor', 'admin'].includes(session.user.perfil ?? '')) {
    redirect('/dashboard')
  }

  const logs = await getLogs()

  return (
    <div>
      <PageHeader
        title="Log de E-mails"
        description="Registro imutável de todos os e-mails enviados pelo sistema."
      />

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-nex-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Destinatário</th>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Cliente</th>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Template</th>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Unidade</th>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Operador</th>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Enviado em</th>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Ver</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nex-gray-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-nex-gray-400">
                  Nenhum e-mail registrado.
                </td>
              </tr>
            )}
            {logs.map((log: any) => (
              <tr key={log.id} className="hover:bg-nex-gray-50">
                <td className="px-4 py-3 font-medium">{log.destinatario}</td>
                <td className="px-4 py-3">{log.clientes?.nome ?? '—'}</td>
                <td className="px-4 py-3">{log.templates_email?.nome ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">
                    {log.unidade === 'nex_house' ? 'NH' : log.unidade === 'francisco_rocha' ? 'FCO' : '—'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-nex-gray-500">{log.operador_email}</td>
                <td className="px-4 py-3 text-nex-gray-500">{formatDateTime(log.sent_at)}</td>
                <td className="px-4 py-3">
                  <LogEmailDialog log={log} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
