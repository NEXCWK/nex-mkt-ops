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
  Handshake,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from 'next-auth/react'

const navItems = [
  { href: '/dashboard',    label: 'Dashboard',     icon: LayoutDashboard, roles: ['operador', 'gestor', 'admin'] },
  { href: '/contratos/novo', label: 'Novo Contrato', icon: FileText,        roles: ['operador', 'gestor', 'admin'] },
  { href: '/emails/novo',  label: 'Novo E-mail',   icon: Mail,            roles: ['operador', 'gestor', 'admin'] },
  { href: '/parceiros',    label: 'Parceiros',      icon: Handshake,       roles: ['gestor', 'admin'] },
  { href: '/historico',    label: 'Histórico',      icon: History,         roles: ['operador', 'gestor', 'admin'] },
  { href: '/log-emails',   label: 'Log de E-mails', icon: ClipboardList,   roles: ['gestor', 'admin'] },
  { href: '/templates',    label: 'Templates',      icon: Settings,        roles: ['gestor', 'admin'] },
  { href: '/usuarios',     label: 'Usuários',       icon: Users,           roles: ['admin'] },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const perfil = session?.user?.perfil ?? 'operador'

  const visibleItems = navItems.filter(item => item.roles.includes(perfil))

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
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {visibleItems.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-nex-gray-100 text-nex-black font-extrabold'
                  : 'text-nex-gray-500 hover:bg-nex-gray-50 hover:text-nex-gray-800 font-bold'
              )}
            >
              <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-nex-black' : 'text-nex-gray-400')} />
              {item.label}
              {isActive && <span className="ml-auto w-1 h-4 rounded-full bg-nex-yellow" />}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-nex-gray-100">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-full bg-nex-gray-100 border border-nex-gray-200 flex items-center justify-center text-nex-black text-xs font-black">
            {session?.user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold text-nex-gray-800 truncate">{session?.user?.name}</p>
            <p className="text-[10px] text-nex-gray-400 capitalize font-bold">{perfil}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-1.5 text-xs text-nex-gray-400 hover:text-nex-gray-700 transition-colors w-full font-bold"
        >
          <LogOut className="h-3 w-3" />
          Sair
        </button>
      </div>
    </aside>
  )
}
