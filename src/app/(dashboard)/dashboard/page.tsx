import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Mail } from 'lucide-react'

async function getDashboardData() {
  const supabase = createServerClient()

  const now = new Date()
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [totalContratos, contratosMes, totalEmails, emailsMes, docsRecentes, emailsRecentes] = await Promise.all([
    supabase.from('documentos_gerados').select('id', { count: 'exact', head: true }),
    supabase.from('documentos_gerados').select('id', { count: 'exact', head: true }).gte('created_at', inicioMes),
    supabase.from('emails_enviados').select('id', { count: 'exact', head: true }),
    supabase.from('emails_enviados').select('id', { count: 'exact', head: true }).gte('sent_at', inicioMes),
    supabase.from('documentos_gerados').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('emails_enviados').select('*').order('sent_at', { ascending: false }).limit(5),
  ])

  return {
    totalContratos: totalContratos.count ?? 0,
    contratosMes: contratosMes.count ?? 0,
    totalEmails: totalEmails.count ?? 0,
    emailsMes: emailsMes.count ?? 0,
    docsRecentes: docsRecentes.data ?? [],
    emailsRecentes: emailsRecentes.data ?? [],
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const data = await getDashboardData()

  const mesAtual = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Olá, ${session?.user?.nome ?? session?.user?.name}. Visão geral da operação.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-nex-gray-500">Contratos Gerados</CardTitle>
            <FileText className="h-4 w-4 text-nex-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalContratos}</div>
            <p className="text-xs text-nex-gray-500 mt-1">Total acumulado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-nex-gray-500">Contratos este mês</CardTitle>
            <FileText className="h-4 w-4 text-nex-yellow" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.contratosMes}</div>
            <p className="text-xs text-nex-gray-500 mt-1 capitalize">{mesAtual}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-nex-gray-500">E-mails Gerados</CardTitle>
            <Mail className="h-4 w-4 text-nex-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalEmails}</div>
            <p className="text-xs text-nex-gray-500 mt-1">Total acumulado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-nex-gray-500">E-mails este mês</CardTitle>
            <Mail className="h-4 w-4 text-nex-yellow" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.emailsMes}</div>
            <p className="text-xs text-nex-gray-500 mt-1 capitalize">{mesAtual}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Contratos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.docsRecentes.length === 0 ? (
              <p className="text-sm text-nex-gray-400">Nenhum contrato gerado ainda.</p>
            ) : (
              <div className="space-y-3">
                {data.docsRecentes.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{doc.tipo}</p>
                      <p className="text-xs text-nex-gray-500">{doc.operador_email}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              E-mails Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.emailsRecentes.length === 0 ? (
              <p className="text-sm text-nex-gray-400">Nenhum e-mail gerado ainda.</p>
            ) : (
              <div className="space-y-3">
                {data.emailsRecentes.map((email: any) => (
                  <div key={email.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">{email.destinatario}</p>
                      <p className="text-xs text-nex-gray-500">{email.operador_email}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {new Date(email.sent_at).toLocaleDateString('pt-BR')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
