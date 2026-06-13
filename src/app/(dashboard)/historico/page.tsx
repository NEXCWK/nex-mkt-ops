import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { HistoricoTable } from '@/components/tables/HistoricoTable'

async function getHistorico() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('documentos_gerados')
    .select('*, clientes(nome), templates_documentos(nome)')
    .order('created_at', { ascending: false })
    .limit(200)
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
      <HistoricoTable docs={docs} />
    </div>
  )
}
