import { createServerClient } from '@/lib/supabase/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { LogEmailsTable } from '@/components/tables/LogEmailsTable'

async function getLogs() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('emails_enviados')
    .select('*, clientes(nome), templates_email(nome)')
    .order('sent_at', { ascending: false })
    .limit(300)
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
        description="Registro imutável de todos os e-mails gerados pelo sistema."
      />
      <LogEmailsTable logs={logs} />
    </div>
  )
}
