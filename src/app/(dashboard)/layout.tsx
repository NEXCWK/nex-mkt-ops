import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div className="flex min-h-screen bg-[#F6F6F6]">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto max-w-[1200px]">
        {children}
      </main>
    </div>
  )
}
