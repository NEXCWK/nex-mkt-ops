import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { probeConversasRest } from '@/lib/rd-conversas-rest'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!process.env.RD_CONVERSAS_TOKEN) {
    return NextResponse.json({ error: 'RD_CONVERSAS_TOKEN não configurado no Railway.' }, { status: 500 })
  }

  // janela padrão: últimos 3 dias (ou ?de=&ate=)
  const ate = req.nextUrl.searchParams.get('ate') ?? new Date().toISOString()
  const de = req.nextUrl.searchParams.get('de') ?? new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()

  try {
    const resultado = await probeConversasRest(de, ate)
    return NextResponse.json({ ok: true, de, ate, ...resultado }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Erro ao contatar a API' }, { status: 500 })
  }
}
