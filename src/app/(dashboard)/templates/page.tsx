import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { SeedTemplatesButton } from '@/components/admin/SeedTemplatesButton'
import { SeedParceirosButton } from '@/components/admin/SeedParceirosButton'
import { ParametrizarIA } from '@/components/templates/ParametrizarIA'
import { EditorTemplatesIA } from '@/components/templates/EditorTemplatesIA'
import { ExcluirTemplateButton } from '@/components/templates/ExcluirTemplateButton'
import { FileText, Mail } from 'lucide-react'

async function getTemplates() {
  const supabase = createServerClient()
  const [docs, emails] = await Promise.all([
    supabase.from('templates_documentos').select('*').order('tipo').order('versao', { ascending: false }),
    supabase.from('templates_email').select('*').order('tipo').order('versao', { ascending: false }),
  ])
  return { docs: docs.data ?? [], emails: emails.data ?? [] }
}

const TH_CLASS = 'text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400'

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions)
  if (!session || !['gestor', 'admin'].includes(session.user.perfil ?? '')) {
    redirect('/dashboard')
  }

  const { docs, emails } = await getTemplates()
  const isAdmin = session.user.perfil === 'admin'

  return (
    <div>
      <PageHeader
        title="Gestão de Templates"
        description="Gerencie os modelos de documentos e e-mails do sistema."
      />

      {isAdmin && (
        <div className="mb-6 bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-nex-gray-100">
            <p className="text-xs font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Administração</p>
          </div>
          <div className="flex flex-wrap gap-6 p-4">
            <div>
              <p className="text-xs text-nex-gray-500 mb-1.5">Templates de Contratos</p>
              <SeedTemplatesButton />
            </div>
            <div>
              <p className="text-xs text-nex-gray-500 mb-1.5">Parceiros Padrão</p>
              <SeedParceirosButton />
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="documentos">
        <TabsList className="mb-6">
          <TabsTrigger value="documentos">Documentos ({docs.length})</TabsTrigger>
          <TabsTrigger value="emails">E-mails ({emails.length})</TabsTrigger>
          <TabsTrigger value="gerador">Gerador de Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="documentos">
          <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-nex-gray-50 border-b border-nex-gray-100">
                  <tr>
                    <th className={TH_CLASS}>Nome</th>
                    <th className={TH_CLASS}>Tipo</th>
                    <th className={TH_CLASS}>Unidade</th>
                    <th className={TH_CLASS}>Versão</th>
                    <th className={TH_CLASS}>Criado por</th>
                    <th className={TH_CLASS}>Data</th>
                    <th className={TH_CLASS}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nex-gray-100">
                  {docs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-14">
                        <div className="flex flex-col items-center gap-2 text-center">
                          <FileText className="w-6 h-6 text-nex-gray-300" />
                          <p className="text-sm text-nex-gray-400">Nenhum template de documento cadastrado.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {docs.map((t: any) => (
                    <tr key={t.id} className="hover:bg-nex-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{t.nome}</td>
                      <td className="px-4 py-3"><Badge variant="secondary">{t.tipo?.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-4 py-3">{t.unidade ?? '—'}</td>
                      <td className="px-4 py-3"><Badge variant="yellow">v{t.versao}</Badge></td>
                      <td className="px-4 py-3 text-nex-gray-500">{t.criado_por ?? '—'}</td>
                      <td className="px-4 py-3 text-nex-gray-500 whitespace-nowrap">{formatDateTime(t.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <ExcluirTemplateButton tipo={t.tipo} nome={t.nome} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="emails">
          <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-nex-gray-50 border-b border-nex-gray-100">
                  <tr>
                    <th className={TH_CLASS}>Nome</th>
                    <th className={TH_CLASS}>Tipo</th>
                    <th className={TH_CLASS}>Versão</th>
                    <th className={TH_CLASS}>Criado por</th>
                    <th className={TH_CLASS}>Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nex-gray-100">
                  {emails.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-14">
                        <div className="flex flex-col items-center gap-2 text-center">
                          <Mail className="w-6 h-6 text-nex-gray-300" />
                          <p className="text-sm text-nex-gray-400">Nenhum template de e-mail cadastrado.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {emails.map((t: any) => (
                    <tr key={t.id} className="hover:bg-nex-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{t.nome}</td>
                      <td className="px-4 py-3"><Badge variant="secondary">{t.tipo?.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-4 py-3"><Badge variant="yellow">v{t.versao}</Badge></td>
                      <td className="px-4 py-3 text-nex-gray-500">{t.criado_por ?? '—'}</td>
                      <td className="px-4 py-3 text-nex-gray-500 whitespace-nowrap">{formatDateTime(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="gerador">
          <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-nex-gray-100">
              <p className="text-sm font-heading font-semibold text-nex-black mb-1">Parametrizar contrato com IA</p>
              <p className="text-xs text-nex-gray-500">
                Faça upload de um contrato .docx preenchido (exemplo real). O Claude identificará todos os dados variáveis,
                substituirá por marcadores <code className="bg-nex-gray-100 px-1 rounded">{'{{token}}'}</code> e gerará
                automaticamente os campos do formulário. Após revisão, importe direto para a aba Novo Contrato.
              </p>
            </div>
            <div className="p-5">
              <ParametrizarIA />
              <EditorTemplatesIA />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
