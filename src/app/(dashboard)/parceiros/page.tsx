import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

async function getData() {
  const supabase = createServerClient()
  const [parceiros, leads] = await Promise.all([
    supabase.from('parceiros').select('*').order('nome'),
    supabase.from('leads_influenciadores').select('*').order('created_at', { ascending: false }),
  ])
  return { parceiros: parceiros.data ?? [], leads: leads.data ?? [] }
}

const STATUS_COLORS: Record<string, string> = {
  ativo: 'success',
  inativo: 'secondary',
  negociacao: 'yellow',
  convertido: 'success',
  perdido: 'destructive',
}

export default async function ParceirosPage() {
  const { parceiros, leads } = await getData()

  return (
    <div>
      <PageHeader
        title="Parceiros e Influenciadores"
        description="Acompanhe parceiros, marketplaces e leads via influenciadores."
      />

      <Tabs defaultValue="parceiros">
        <TabsList className="mb-6">
          <TabsTrigger value="parceiros">Parceiros ({parceiros.length})</TabsTrigger>
          <TabsTrigger value="leads">Leads por Influenciador ({leads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="parceiros">
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-nex-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Parceiro</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Canal</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Volume</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nex-gray-100">
                {parceiros.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-nex-gray-400">Nenhum parceiro cadastrado.</td></tr>
                )}
                {parceiros.map((p: any) => (
                  <tr key={p.id} className="hover:bg-nex-gray-50">
                    <td className="px-4 py-3 font-medium">{p.nome}</td>
                    <td className="px-4 py-3 text-nex-gray-500">{p.canal ?? '—'}</td>
                    <td className="px-4 py-3">{p.volume ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={(STATUS_COLORS[p.status] ?? 'secondary') as any}>{p.status ?? '—'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="leads">
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-nex-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Lead</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Influenciador</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Unidade</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nex-gray-100">
                {leads.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-nex-gray-400">Nenhum lead cadastrado.</td></tr>
                )}
                {leads.map((l: any) => (
                  <tr key={l.id} className="hover:bg-nex-gray-50">
                    <td className="px-4 py-3 font-medium">{l.nome}</td>
                    <td className="px-4 py-3">{l.influenciador ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        {l.unidade === 'nex_house' ? 'NH' : l.unidade === 'francisco_rocha' ? 'FCO' : '—'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={(STATUS_COLORS[l.status] ?? 'secondary') as any}>{l.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-nex-gray-500">{new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
