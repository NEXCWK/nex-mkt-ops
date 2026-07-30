import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface ContatoInput {
  empresa?: string
  nome?: string
  email: string
  whatsapp?: string
  produto?: string
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('cco_contatos')
    .select('*')
    .order('empresa', { ascending: true })
    .order('nome', { ascending: true })
    .limit(5000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contatos: data ?? [] })
}

/** Cadastra um contato manualmente, ou importa/atualiza vários de uma vez (upsert por e-mail). */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const lista: ContatoInput[] = Array.isArray(body.contatos)
    ? body.contatos
    : body.contato
      ? [body.contato]
      : []

  const linhas = lista
    .map(c => ({
      empresa: (c.empresa ?? '').trim() || null,
      nome: (c.nome ?? '').trim() || null,
      email: (c.email ?? '').trim().toLowerCase(),
      whatsapp: (c.whatsapp ?? '').trim() || null,
      produto: (c.produto ?? '').trim() || null,
      criado_por: session.user.email,
      updated_at: new Date().toISOString(),
    }))
    .filter(c => c.email.includes('@'))

  if (linhas.length === 0) {
    return NextResponse.json({ error: 'Nenhum contato válido informado (e-mail é obrigatório)' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('cco_contatos')
    .upsert(linhas, { onConflict: 'email' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contatos: data ?? [], salvos: data?.length ?? 0 })
}

/** Exclusão em lote: DELETE com body { ids: string[] }. */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body.ids) ? body.ids : []
  if (ids.length === 0) return NextResponse.json({ error: 'Informe ao menos um id' }, { status: 400 })

  const supabase = createServerClient()
  const { error } = await supabase.from('cco_contatos').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
