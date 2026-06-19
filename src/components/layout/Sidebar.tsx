'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import {
  LayoutDashboard,
  FileText,
  Mail,
  Users,
  History,
  ClipboardList,
  Settings,
  LogOut,
  UserCircle,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from 'next-auth/react'

const navSections = [
  {
    label: 'Operação',
    items: [
      { href: '/dashboard',      label: 'Dashboard',     icon: LayoutDashboard, roles: ['operador', 'gestor', 'admin'] },
      { href: '/contratos/novo', label: 'Novo Contrato', icon: FileText,        roles: ['operador', 'gestor', 'admin'] },
      { href: '/emails/novo',    label: 'Novo E-mail',   icon: Mail,            roles: ['operador', 'gestor', 'admin'] },
      { href: '/assistente',     label: 'Assistente',    icon: Sparkles,        roles: ['operador', 'gestor', 'admin'] },
    ],
  },
  {
    label: 'Registros',
    items: [
      { href: '/historico',  label: 'Histórico',      icon: History,       roles: ['operador', 'gestor', 'admin'] },
      { href: '/log-emails', label: 'Log de E-mails', icon: ClipboardList, roles: ['gestor', 'admin'] },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/templates', label: 'Templates', icon: Settings,  roles: ['gestor', 'admin'] },
      { href: '/usuarios',  label: 'Usuários',  icon: Users,     roles: ['admin'] },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const perfil = session?.user?.perfil ?? 'operador'

  const visibleSections = navSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.roles.includes(perfil)),
    }))
    .filter(section => section.items.length > 0)

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-nex-gray-200 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-nex-gray-100">
        <Image
          src="/nex-logo.png"
          alt="Nex."
          width={72}
          height={28}
          priority
          style={{ objectFit: 'contain' }}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-5 overflow-y-auto">
        {visibleSections.map(section => (
          <div key={section.label}>
            <p className="px-3 mb-1.5 text-[10px] font-heading font-semibold uppercase tracking-widest text-nex-gray-300">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-heading transition-colors',
                      isActive
                        ? 'bg-nex-gray-100 text-nex-black font-semibold'
                        : 'text-nex-gray-500 hover:bg-nex-gray-50 hover:text-nex-gray-800 font-normal'
                    )}
                  >
                    <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-nex-black' : 'text-nex-gray-400')} />
                    {item.label}
                    {isActive && <span className="ml-auto w-1 h-4 rounded-full bg-nex-yellow" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-nex-gray-100">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-full bg-nex-gray-100 border border-nex-gray-200 flex items-center justify-center text-nex-black text-xs font-heading font-semibold">
            {session?.user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-heading font-semibold text-nex-gray-800 truncate">{session?.user?.name}</p>
            <p className="text-[10px] text-nex-gray-400 capitalize">{perfil}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/perfil"
            className="flex items-center gap-1.5 text-xs text-nex-gray-400 hover:text-nex-gray-700 transition-colors"
          >
            <UserCircle className="h-3 w-3" />
            Perfil
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-1.5 text-xs text-nex-gray-400 hover:text-nex-gray-700 transition-colors"
          >
            <LogOut className="h-3 w-3" />
            Sair
          </button>
        </div>
      </div>
    </aside>
  )
}
