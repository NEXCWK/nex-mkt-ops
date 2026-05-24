import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { Building2, FileText, Mail, TrendingUp } from 'lucide-react'

async function getDashboardData() {
  const supabase = createServerClient()

  const [espacos, documentos, emails] = await Promise.all([
    supabase.from('espacos').select('*'),
    supabase.from('documentos_gerados').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('emails_enviados').select('*').order('sent_at', { ascending: false }).limit(5),
  ])

  const total = espacos.data?.length ?? 0
  const ocupados = espacos.data?.filter(e => e.status === 'ocupado').length ?? 0
  const disponiveis = espacos.data?.filter(e => e.status === 'disponivel').length ?? 0
  const churnSinalizado = espacos.data?.filter(e => e.churn_sinalizado).length ?? 0
  const receitaMensal = espacos.data
    ?.filter(e => e.status === 'ocupado')
    .reduce((sum, e) => sum + (e.preco ?? 0), 0) ?? 0

  return {
    total,
    ocupados,
    disponiveis,
    churnSinalizado,
    receitaMensal,
    documentosRecentes: documentos.data ?? [],
    emailsRecentes: emails.data ?? [],
    taxaOcupacao: total > 0 ? Math.round((ocupados / total) * 100) : 0,
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const data = await getDashboardData()

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Bom dia, ${session?.user?.nome ?? session?.user?.name}. Visão geral da operação.`}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-nex-gray-500">Receita Mensal</CardTitle>
            <TrendingUp className="h-4 w-4 text-nex-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.receitaMensal)}</div>
            <p className="text-xs text-nex-gray-500 mt-1">Espaços ocupados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-nex-gray-500">Ocupação</CardTitle>
            <Building2 className="h-4 w-4 text-nex-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.taxaOcupacao}%</div>
            <p className="text-xs text-nex-gray-500 mt-1">{data.ocupados}/{data.total} espaços</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-nex-gray-500">Disponíveis</CardTitle>
            <Building2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.disponiveis}</div>
            <p className="text-xs text-nex-gray-500 mt-1">Espaços livres agora</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-nex-gray-500">Churn Sinalizado</CardTitle>
            <Building2 className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{data.churnSinalizado}</div>
            <p className="text-xs text-nex-gray-500 mt-1">Saídas previstas</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Documentos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.documentosRecentes.length === 0 ? (
              <p className="text-sm text-nex-gray-400">Nenhum documento gerado ainda.</p>
            ) : (
              <div className="space-y-3">
                {data.documentosRecentes.map((doc: any) => (
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
              <p className="text-sm text-nex-gray-400">Nenhum e-mail enviado ainda.</p>
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
