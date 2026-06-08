import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const bearerToken = req.headers.get('authorization')?.replace('Bearer ', '')
  const seedSecret = process.env.SEED_SECRET

  if (!seedSecret || bearerToken !== seedSecret) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { email, nome, perfil } = await req.json()

  if (!email || !nome || !perfil) {
    return NextResponse.json({ error: 'email, nome e perfil são obrigatórios' }, { status: 400 })
  }

  if (!['operador', 'gestor', 'admin'].includes(perfil)) {
    return NextResponse.json({ error: 'perfil inválido' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('usuarios')
      .update({ nome, perfil, ativo: true })
      .eq('email', email)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ status: 'updated', email })
  }

  const { error } = await supabase
    .from('usuarios')
    .insert({ email, nome, perfil, ativo: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'created', email })
}
