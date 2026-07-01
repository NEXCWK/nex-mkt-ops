import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo') ?? 'atendimento'
  const atendente = searchParams.get('atendente')
  const de = searchParams.get('de')
  const ate = searchParams.get('ate')

  const supabase = createServerClient()
  let query = supabase
    .from('avaliacoes_conversas')
    .select('*')
    .eq('tipo', tipo)
    .order('created_at', { ascending: false })

  if (atendente) query = query.eq('atendente', atendente)
  if (de) query = query.gte('data', de)
  if (ate) query = query.lte('data', ate)

  const { data, error } = await query.limit(2000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ conversas: data ?? [] })
}
