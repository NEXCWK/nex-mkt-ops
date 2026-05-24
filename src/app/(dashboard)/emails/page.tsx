import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'

async function getEmails() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('emails_enviados')
    .select('*, clientes(nome)')
    .order('sent_at', { ascending: false })
    .limit(50)
  return data ?? []
}

export default async function EmailsPage() {
  const emails = await getEmails()

  return (
    <div>
      <PageHeader
        title="E-mails"
        description="Histórico de e-mails enviados."
        actions={
          <Button variant="primary" asChild>
            <Link href="/emails/novo">
              <Plus className="h-4 w-4" />
              Novo E-mail
            </Link>
          </Button>
        }
      />

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-nex-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Destinatário</th>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Cliente</th>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Unidade</th>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Operador</th>
              <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Enviado em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nex-gray-100">
            {emails.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-nex-gray-400">
                  Nenhum e-mail enviado ainda.
                </td>
              </tr>
            )}
            {emails.map((email: any) => (
              <tr key={email.id} className="hover:bg-nex-gray-50">
                <td className="px-4 py-3 font-medium">{email.destinatario}</td>
                <td className="px-4 py-3">{email.clientes?.nome ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">
                    {email.unidade === 'nex_house' ? 'Nex House' : email.unidade === 'francisco_rocha' ? 'Francisco Rocha' : '—'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-nex-gray-500">{email.operador_email}</td>
                <td className="px-4 py-3 text-nex-gray-500">{formatDateTime(email.sent_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
