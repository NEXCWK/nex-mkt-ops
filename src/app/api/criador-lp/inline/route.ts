import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { inlineLP } from '@/lib/lp-inline'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Devolve o HTML da LP autossuficiente (CSS + fontes + logos embutidos). */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { html } = await req.json()
  if (!html) return NextResponse.json({ error: 'HTML ausente' }, { status: 400 })

  try {
    return NextResponse.json({ html: inlineLP(html) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao processar' }, { status: 500 })
  }
}
