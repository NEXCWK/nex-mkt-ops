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
  let query = supabase.from('modelos_referencia').select('*').order('created_at', { ascending: false })
  if (contexto) query = query.eq('contexto', contexto)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ modelos: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { contexto, nome, html, css, js } = await req.json()
  if (!contexto || !nome) return NextResponse.json({ error: 'Informe contexto e nome do modelo' }, { status: 400 })
  if (!html && !css && !js) return NextResponse.json({ error: 'Envie ao menos um conteúdo (HTML, CSS ou JS)' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('modelos_referencia')
    .insert({ contexto, nome, html: html || null, css: css || null, js: js || null, operador_email: session.user.email })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ modelo: data })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Informe o id' }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase.from('modelos_referencia').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
