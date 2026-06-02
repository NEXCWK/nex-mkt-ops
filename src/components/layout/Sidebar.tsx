'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import {
  LayoutDashboard,
  FileText,
  Presentation,
  Mail,
  Building2,
  Users,
  History,
  ClipboardList,
  Settings,
  LogOut,
  Handshake,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from 'next-auth/react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['operador', 'gestor', 'admin'] },
  { href: '/contratos/novo', label: 'Novo Contrato', icon: FileText, roles: ['operador', 'gestor', 'admin'] },
  { href: '/propostas/nova', label: 'Nova Proposta', icon: Presentation, roles: ['operador', 'gestor', 'admin'] },
  { href: '/emails/novo', label: 'Novo E-mail', icon: Mail, roles: ['operador', 'gestor', 'admin'] },
  { href: '/espacos', label: 'Painel de Espaços', icon: Building2, roles: ['operador', 'gestor', 'admin'] },
  { href: '/parceiros', label: 'Parceiros', icon: Handshake, roles: ['gestor', 'admin'] },
  { href: '/historico', label: 'Histórico', icon: History, roles: ['operador', 'gestor', 'admin'] },
  { href: '/log-emails', label: 'Log de E-mails', icon: ClipboardList, roles: ['gestor', 'admin'] },
  { href: '/templates', label: 'Templates', icon: Settings, roles: ['gestor', 'admin'] },
  { href: '/usuarios', label: 'Usuários', icon: Users, roles: ['admin'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const perfil = session?.user?.perfil ?? 'operador'

  const visibleItems = navItems.filter(item => item.roles.includes(perfil))

  return (
    <aside className="w-64 min-h-screen bg-nex-black text-white flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-nex-gray-700">
        <Image
          src="/nex-logo-white.png"
          alt="Nex"
          width={80}
          height={24}
          priority
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleItems.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-nex-yellow text-nex-black font-semibold'
                  : 'text-nex-gray-300 hover:bg-nex-gray-800 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-nex-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-nex-yellow flex items-center justify-center text-nex-black text-sm font-bold">
            {session?.user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{session?.user?.name}</p>
            <p className="text-xs text-nex-gray-400 capitalize">{perfil}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 text-xs text-nex-gray-400 hover:text-white transition-colors w-full"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </aside>
  )
}
