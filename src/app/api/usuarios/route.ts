import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.perfil !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const supabase = createServerClient()
  const { data } = await supabase
    .from('usuarios')
    .select('*')
    .order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.perfil !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { email, nome, perfil } = await req.json()
    if (!email || !perfil) {
      return NextResponse.json({ error: 'Email e perfil são obrigatórios' }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('usuarios')
      .insert({ email, nome, perfil, ativo: true })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
