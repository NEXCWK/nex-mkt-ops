import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listMCPTools } from '@/lib/rdcrm-mcp'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const tools = await listMCPTools()
    return NextResponse.json({ tools, count: tools.length })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao contatar MCP' },
      { status: 500 }
    )
  }
}
