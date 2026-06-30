import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listMCPTools, callTool } from '@/lib/rdcrm-mcp'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    // 1. Lista todas as tools disponíveis
    const tools = await listMCPTools()

    // 2. Tenta chamar cada tool sem argumentos para ver o que responde
    const samples: Record<string, unknown> = {}
    for (const t of tools.slice(0, 10)) {
      try {
        const res = await callTool(t.name, {})
        samples[t.name] = res
      } catch (e) {
        samples[t.name] = { error: e instanceof Error ? e.message : String(e) }
      }
    }

    return NextResponse.json({ tools, samples })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao contatar MCP' },
      { status: 500 }
    )
  }
}
