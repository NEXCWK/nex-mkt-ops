import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const contexto = req.nextUrl.searchParams.get('contexto')
  const supabase = createServerClient()
  let query = supabase.from('criacoes_historico').select('*').order('created_at', { ascending: false }).limit(100)
  if (contexto) query = query.eq('contexto', contexto)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ criacoes: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { contexto, produto, vigencia, desconto, titulo, descricao, conteudo } = await req.json()
  if (!contexto || !conteudo) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('criacoes_historico')
    .insert({
      contexto, produto: produto || null, vigencia: vigencia || null, desconto: desconto || null,
      titulo: titulo || null, descricao: descricao || null, conteudo,
      operador_email: session.user.email,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ criacao: data })
}
