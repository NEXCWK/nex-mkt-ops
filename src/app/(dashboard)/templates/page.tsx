import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'

async function getTemplates() {
  const supabase = createServerClient()
  const [docs, emails] = await Promise.all([
    supabase.from('templates_documentos').select('*').order('tipo').order('versao', { ascending: false }),
    supabase.from('templates_email').select('*').order('tipo').order('versao', { ascending: false }),
  ])
  return { docs: docs.data ?? [], emails: emails.data ?? [] }
}

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions)
  if (!session || !['gestor', 'admin'].includes(session.user.perfil ?? '')) {
    redirect('/dashboard')
  }

  const { docs, emails } = await getTemplates()

  return (
    <div>
      <PageHeader
        title="Gestão de Templates"
        description="Gerencie os modelos de documentos e e-mails do sistema."
      />

      <Tabs defaultValue="documentos">
        <TabsList className="mb-6">
          <TabsTrigger value="documentos">Documentos ({docs.length})</TabsTrigger>
          <TabsTrigger value="emails">E-mails ({emails.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="documentos">
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-nex-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Unidade</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Versão</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Criado por</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nex-gray-100">
                {docs.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-nex-gray-400">Nenhum template de documento cadastrado.</td></tr>
                )}
                {docs.map((t: any) => (
                  <tr key={t.id} className="hover:bg-nex-gray-50">
                    <td className="px-4 py-3 font-medium">{t.nome}</td>
                    <td className="px-4 py-3"><Badge variant="secondary">{t.tipo}</Badge></td>
                    <td className="px-4 py-3">{t.unidade ?? '—'}</td>
                    <td className="px-4 py-3"><Badge variant="yellow">v{t.versao}</Badge></td>
                    <td className="px-4 py-3 text-nex-gray-500">{t.criado_por ?? '—'}</td>
                    <td className="px-4 py-3 text-nex-gray-500">{formatDateTime(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="emails">
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-nex-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Versão</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Criado por</th>
                  <th className="text-left px-4 py-3 font-semibold text-nex-gray-600">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nex-gray-100">
                {emails.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-nex-gray-400">Nenhum template de e-mail cadastrado.</td></tr>
                )}
                {emails.map((t: any) => (
                  <tr key={t.id} className="hover:bg-nex-gray-50">
                    <td className="px-4 py-3 font-medium">{t.nome}</td>
                    <td className="px-4 py-3"><Badge variant="secondary">{t.tipo}</Badge></td>
                    <td className="px-4 py-3"><Badge variant="yellow">v{t.versao}</Badge></td>
                    <td className="px-4 py-3 text-nex-gray-500">{t.criado_por ?? '—'}</td>
                    <td className="px-4 py-3 text-nex-gray-500">{formatDateTime(t.created_at)}</td>
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
