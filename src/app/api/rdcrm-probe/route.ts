import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { probeMCP } from '@/lib/rdcrm-mcp'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const { tools, trace, sessionId } = await probeMCP()
    return NextResponse.json({
      ok: true,
      sessionId,
      toolCount: tools.length,
      tools,
      trace, // status HTTP, content-type, session id e corpo bruto de cada chamada
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Erro ao contatar MCP' },
      { status: 500 }
    )
  }
}
