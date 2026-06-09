import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { UsuarioActions } from '@/components/usuarios/UsuarioActions'
import { AddUsuarioDialog } from '@/components/usuarios/AddUsuarioDialog'
import { Users } from 'lucide-react'

async function getUsuarios() {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('usuarios')
    .select('*')
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function UsuariosPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'admin') {
    redirect('/dashboard')
  }

  const usuarios = await getUsuarios()

  return (
    <div>
      <PageHeader
        title="Gestão de Usuários"
        description="Gerencie a whitelist de contas Google autorizadas."
        actions={<AddUsuarioDialog />}
      />

      <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-nex-gray-50 border-b border-nex-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">E-mail</th>
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Nome</th>
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Perfil</th>
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Status</th>
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Criado em</th>
                <th className="text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nex-gray-100">
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-14">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Users className="w-6 h-6 text-nex-gray-300" />
                      <p className="text-sm text-nex-gray-400">Nenhum usuário cadastrado.</p>
                    </div>
                  </td>
                </tr>
              )}
              {usuarios.map((u: any) => (
                <tr key={u.id} className="hover:bg-nex-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.email}</td>
                  <td className="px-4 py-3">{u.nome ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.perfil === 'admin' ? 'default' : u.perfil === 'gestor' ? 'yellow' : 'secondary'}>
                      {u.perfil}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={u.ativo ? 'success' : 'destructive'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-nex-gray-500 whitespace-nowrap">{formatDateTime(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <UsuarioActions usuario={u} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
