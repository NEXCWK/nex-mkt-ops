import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface UsoTokensRow {
  funcionalidade: string
  modelo: string
  tokens_input: number
  tokens_output: number
  custo_estimado_usd: number | null
  created_at: string
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const de = searchParams.get('de')
  const ate = searchParams.get('ate')

  const supabase = createServerClient()
  let query = supabase
    .from('uso_tokens')
    .select('funcionalidade, modelo, tokens_input, tokens_output, custo_estimado_usd, created_at')
    .order('created_at', { ascending: false })

  if (de) query = query.gte('created_at', de)
  if (ate) query = query.lte('created_at', ate)

  const { data, error } = await query.limit(20000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const linhas = (data ?? []) as UsoTokensRow[]

  const porFuncionalidade = new Map<string, {
    funcionalidade: string
    chamadas: number
    tokensInput: number
    tokensOutput: number
    custoUsd: number
  }>()

  let custoTotal = 0
  let chamadasTotal = 0

  for (const linha of linhas) {
    const atual = porFuncionalidade.get(linha.funcionalidade) ?? {
      funcionalidade: linha.funcionalidade,
      chamadas: 0,
      tokensInput: 0,
      tokensOutput: 0,
      custoUsd: 0,
    }
    atual.chamadas += 1
    atual.tokensInput += linha.tokens_input
    atual.tokensOutput += linha.tokens_output
    atual.custoUsd += linha.custo_estimado_usd ?? 0
    porFuncionalidade.set(linha.funcionalidade, atual)

    custoTotal += linha.custo_estimado_usd ?? 0
    chamadasTotal += 1
  }

  const resumo = Array.from(porFuncionalidade.values()).sort((a, b) => b.custoUsd - a.custoUsd)

  return NextResponse.json({
    resumo,
    custoTotalUsd: custoTotal,
    chamadasTotal,
    periodoDe: de,
    periodoAte: ate,
  })
}
