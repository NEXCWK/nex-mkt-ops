import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const email = String(body.email ?? '').trim().toLowerCase()
  if (!email.includes('@')) return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('cco_contatos')
    .update({
      empresa: (body.empresa ?? '').trim() || null,
      nome: (body.nome ?? '').trim() || null,
      email,
      whatsapp: (body.whatsapp ?? '').trim() || null,
      produto: (body.produto ?? '').trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contato: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id } = await params
  const supabase = createServerClient()
  const { error } = await supabase.from('cco_contatos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
