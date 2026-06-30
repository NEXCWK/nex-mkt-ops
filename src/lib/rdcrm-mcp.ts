/**
 * Cliente MCP para o servidor rdstationmentor.com
 * Usa o protocolo MCP Streamable HTTP (JSON-RPC 2.0 via POST)
 */

const MCP_URL = 'https://mcp.rdstationmentor.com/crm/mcp?key=019ef10b-1d90-7f41-a943-d274c1c5571c'

let _id = 0
function nextId() { return ++_id }

async function rpc(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId(), method, params }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`MCP ${method} → HTTP ${res.status} ${res.statusText}: ${body.slice(0, 200)}`)
  }

  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('text/event-stream')) {
    const text = await res.text()
    const dataLine = text.split('\n').find(l => l.startsWith('data: '))
    if (!dataLine) throw new Error(`MCP ${method}: SSE sem dados`)
    return JSON.parse(dataLine.slice(6)) as Record<string, unknown>
  }

  return res.json() as Promise<Record<string, unknown>>
}

function extractText(res: Record<string, unknown>): string | null {
  const result = (res.result ?? res) as Record<string, unknown>
  const content = result.content as Array<{ type: string; text: string }> | undefined
  if (!Array.isArray(content)) return null
  return content.find(c => c.type === 'text')?.text ?? null
}

function parseResult<T>(res: Record<string, unknown>): T | null {
  const text = extractText(res)
  if (!text) return null
  try { return JSON.parse(text) as T } catch { return null }
}

export interface MCPTool {
  name: string
  description?: string
}

/** Lista todas as tools disponíveis no servidor MCP */
export async function listMCPTools(): Promise<MCPTool[]> {
  try {
    // Inicialização obrigatória no protocolo MCP
    await rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'nex-mkt-ops', version: '1.0' },
    })
    const res = await rpc('tools/list', {})
    const tools = ((res.result as Record<string, unknown>)?.tools ?? res.tools) as MCPTool[]
    return Array.isArray(tools) ? tools : []
  } catch (e) {
    console.error('[mcp] listMCPTools error:', e instanceof Error ? e.message : e)
    return []
  }
}

/** Chama uma tool pelo nome e retorna o resultado parseado */
export async function callTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T | null> {
  const res = await rpc('tools/call', { name, arguments: args })
  if ((res as Record<string, unknown>).error) {
    const err = (res as Record<string, unknown>).error as { message: string }
    throw new Error(`MCP tool '${name}': ${err.message}`)
  }
  return parseResult<T>(res)
}

export interface RDFunnel  { _id: string; name: string }
export interface RDStage   { _id: string; name: string; deal_pipeline_id: string }
export interface RDDeal    {
  _id: string; name: string; deal_stage_id: string; deal_pipeline_id: string
  created_at: string; updated_at: string
  win: boolean | null; hold: boolean | null
  amount_montly: number | null; amount_total: number | null
}

// Nomes de tool a tentar para cada operação (por ordem de probabilidade)
const FUNNEL_TOOLS  = ['listar_funis', 'list_deal_pipelines', 'get_pipelines', 'deal_pipelines', 'listarFunis', 'obter_funis']
const STAGE_TOOLS   = ['listar_etapas', 'list_deal_pipeline_stages', 'get_stages', 'deal_pipeline_stages', 'listarEtapas']
const DEAL_TOOLS    = ['listar_negociacoes', 'list_deals', 'get_deals', 'deals', 'buscar_negociacoes', 'listarNegociacoes']

async function tryTools<T>(names: string[], args: Record<string, unknown> = {}): Promise<T | null> {
  for (const name of names) {
    try {
      const result = await callTool<T>(name, args)
      if (result !== null) {
        console.log(`[mcp] tool '${name}' funcionou`)
        return result
      }
    } catch (e) {
      console.log(`[mcp] tool '${name}' falhou:`, e instanceof Error ? e.message.slice(0, 80) : e)
    }
  }
  return null
}

export async function listFunnelsMCP(): Promise<RDFunnel[]> {
  const res = await tryTools<RDFunnel[] | { deal_pipelines: RDFunnel[] }>(FUNNEL_TOOLS)
  if (!res) return []
  if (Array.isArray(res)) return res
  return (res as { deal_pipelines: RDFunnel[] }).deal_pipelines ?? []
}

export async function listStagesMCP(pipelineId: string): Promise<RDStage[]> {
  const res = await tryTools<RDStage[] | { deal_pipeline_stages: RDStage[] }>(STAGE_TOOLS, {
    deal_pipeline_id: pipelineId,
    pipeline_id: pipelineId,
    funil_id: pipelineId,
  })
  if (!res) return []
  if (Array.isArray(res)) return res
  return (res as { deal_pipeline_stages: RDStage[] }).deal_pipeline_stages ?? []
}

export async function listAllDealsMCP(pipelineId: string): Promise<RDDeal[]> {
  const all: RDDeal[] = []
  let page = 1
  const LIMIT = 200

  while (true) {
    const res = await tryTools<RDDeal[] | { deals: RDDeal[]; total?: number }>(DEAL_TOOLS, {
      deal_pipeline_id: pipelineId,
      pipeline_id: pipelineId,
      funil_id: pipelineId,
      page,
      limit: LIMIT,
    })
    if (!res) break

    const batch = Array.isArray(res) ? res : ((res as { deals: RDDeal[] }).deals ?? [])
    const total = Array.isArray(res) ? undefined : (res as { total?: number }).total

    all.push(...batch)
    if (batch.length < LIMIT || (total !== undefined && all.length >= total)) break
    page++
    if (page > 50) break
  }
  return all
}
