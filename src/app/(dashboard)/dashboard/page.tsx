import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Mail, ArrowRight } from 'lucide-react'

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

  const mesAtual = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Olá, ${session?.user?.nome ?? session?.user?.name}. Visão geral da operação.`}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-nex-gray-400" />
              <p className="text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Contratos Gerados</p>
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold leading-none">{data.totalContratos}</p>
                <p className="text-xs text-nex-gray-400 mt-1.5">Total acumulado</p>
              </div>
              <div className="text-right pb-0.5">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-nex-black">
                  <span className="w-1.5 h-1.5 rounded-full bg-nex-yellow" />
                  +{data.contratosMes}
                </p>
                <p className="text-[11px] text-nex-gray-400 capitalize">{mesAtual}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="h-4 w-4 text-nex-gray-400" />
              <p className="text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">E-mails Gerados</p>
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold leading-none">{data.totalEmails}</p>
                <p className="text-xs text-nex-gray-400 mt-1.5">Total acumulado</p>
              </div>
              <div className="text-right pb-0.5">
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-nex-black">
                  <span className="w-1.5 h-1.5 rounded-full bg-nex-yellow" />
                  +{data.emailsMes}
                </p>
                <p className="text-[11px] text-nex-gray-400 capitalize">{mesAtual}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Contratos Recentes
            </CardTitle>
            <Link
              href="/historico"
              className="flex items-center gap-1 text-xs text-nex-gray-400 hover:text-nex-black transition-colors"
            >
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.docsRecentes.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-nex-gray-400 mb-1">Nenhum contrato gerado ainda.</p>
                <Link href="/contratos/novo" className="text-xs text-nex-gray-500 underline underline-offset-2 hover:text-nex-black transition-colors">
                  Gerar o primeiro contrato
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {data.docsRecentes.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize truncate">{doc.tipo?.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-nex-gray-500 truncate">{doc.operador_email}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {new Date(doc.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              E-mails Recentes
            </CardTitle>
            <Link
              href="/log-emails"
              className="flex items-center gap-1 text-xs text-nex-gray-400 hover:text-nex-black transition-colors"
            >
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.emailsRecentes.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-nex-gray-400 mb-1">Nenhum e-mail gerado ainda.</p>
                <Link href="/emails/novo" className="text-xs text-nex-gray-500 underline underline-offset-2 hover:text-nex-black transition-colors">
                  Criar o primeiro e-mail
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {data.emailsRecentes.map((email: any) => (
                  <div key={email.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{email.destinatario}</p>
                      <p className="text-xs text-nex-gray-500 truncate">{email.operador_email}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {new Date(email.sent_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
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
