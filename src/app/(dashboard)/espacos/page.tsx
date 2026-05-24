import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { EspacoActions } from '@/components/espacos/EspacoActions'
import { Building2, AlertTriangle } from 'lucide-react'
import type { Espaco } from '@/types'

async function getEspacos() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('espacos')
    .select('*, clientes(nome, email)')
    .order('unidade')
    .order('nome')
  return (data ?? []) as (Espaco & { clientes?: { nome: string; email: string } })[]
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'disponivel') return <Badge variant="success">Disponível</Badge>
  if (status === 'ocupado') return <Badge variant="secondary">Ocupado</Badge>
  if (status === 'manutencao') return <Badge variant="destructive">Manutenção</Badge>
  return null
}

export default async function EspacosPage() {
  const espacos = await getEspacos()

  const nexHouse = espacos.filter(e => e.unidade === 'nex_house')
  const francisrocha = espacos.filter(e => e.unidade === 'francisco_rocha')
  const churns = espacos.filter(e => e.churn_sinalizado)

  return (
    <div>
      <PageHeader
        title="Painel de Espaços"
        description="Estoque de espaços por unidade, ocupação e churn."
      />

      {churns.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <p className="text-sm font-semibold text-red-700">Churns Sinalizados ({churns.length})</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {churns.map(e => (
              <div key={e.id} className="text-xs bg-white border border-red-200 rounded px-2 py-1">
                <span className="font-medium">{e.nome}</span>
                {e.churn_data && <span className="text-nex-gray-500 ml-1">— disponível em {formatDate(e.churn_data)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {[
          { label: 'Nex House', data: nexHouse },
          { label: 'Francisco Rocha', data: francisrocha },
        ].map(({ label, data }) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                {label}
                <span className="ml-auto text-xs font-normal text-nex-gray-500">
                  {data.filter(e => e.status === 'ocupado').length}/{data.length} ocupados
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.length === 0 ? (
                <p className="px-6 py-4 text-sm text-nex-gray-400">Nenhum espaço cadastrado.</p>
              ) : (
                <div className="divide-y">
                  {data.map(espaco => (
                    <div key={espaco.id} className="px-6 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium">{espaco.nome}</p>
                          {espaco.churn_sinalizado && (
                            <span className="nex-badge-churn">Churn</span>
                          )}
                        </div>
                        <p className="text-xs text-nex-gray-500">
                          {espaco.tipo?.replace(/_/g, ' ')}
                          {espaco.preco && ` · ${formatCurrency(espaco.preco)}/mês`}
                        </p>
                        {espaco.status === 'ocupado' && espaco.clientes && (
                          <p className="text-xs text-nex-gray-400">{espaco.clientes.nome}</p>
                        )}
                        {espaco.churn_sinalizado && espaco.churn_data && (
                          <p className="text-xs text-red-500">Disponível em: {formatDate(espaco.churn_data)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={espaco.status} />
                        <EspacoActions espaco={espaco} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
