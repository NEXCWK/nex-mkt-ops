import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const tipo = req.nextUrl.searchParams.get('tipo')
  const supabase = createServerClient()
  let query = supabase.from('prospeccao_listas').select('*').order('created_at', { ascending: false })
  if (tipo) query = query.eq('tipo', tipo)

  const { data, error } = await query.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ listas: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { tipo, nome, regiao, nicho, produto, empresas, assunto, corpo } = await req.json()
  if (!tipo || !nome || !Array.isArray(empresas) || empresas.length === 0) {
    return NextResponse.json({ error: 'Informe tipo, nome e ao menos uma empresa' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('prospeccao_listas')
    .insert({
      tipo, nome, regiao: regiao || null, nicho: nicho || null, produto: produto || null,
      empresas, assunto: assunto || null, corpo: corpo || null,
      operador_email: session.user.email,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lista: data })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Informe o id' }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase.from('prospeccao_listas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
