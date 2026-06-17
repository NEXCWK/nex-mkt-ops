import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { ParceirosClient } from './ParceirosClient'

async function getParceiros() {
  const supabase = createServerClient()
  const { data } = await supabase.from('parceiros').select('*').order('nome')
  return data ?? []
}

export default async function ParceirosPage() {
  const session = await getServerSession(authOptions)
  if (!session || !['gestor', 'admin'].includes(session.user.perfil ?? '')) {
    redirect('/dashboard')
  }

  const parceiros = await getParceiros()

  return (
    <div>
      <PageHeader
        title="Marketplaces"
        description="Marketplaces e plataformas parceiras do Nex."
      />
      <ParceirosClient initial={parceiros} />
    </div>
  )
}
