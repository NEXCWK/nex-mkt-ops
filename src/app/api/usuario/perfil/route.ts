import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = createServerClient()
  const { data } = await supabase
    .from('usuarios')
    .select('id, email, nome, perfil, assinatura_url')
    .eq('email', session.user.email!)
    .single()

  return NextResponse.json(data ?? {})
}
