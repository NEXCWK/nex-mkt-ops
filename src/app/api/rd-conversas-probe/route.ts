import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { probeConversas } from '@/lib/rd-conversas'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!process.env.RD_CONVERSAS_MCP_URL) {
    return NextResponse.json({ error: 'RD_CONVERSAS_MCP_URL não configurada no Railway.' }, { status: 500 })
  }

  try {
    const { tools, trace } = await probeConversas()
    return NextResponse.json(
      {
        ok: true,
        toolCount: tools.length,
        tools: tools.map(t => ({ name: t.name, description: t.description })),
        trace,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Erro ao contatar o MCP' }, { status: 500 })
  }
}
