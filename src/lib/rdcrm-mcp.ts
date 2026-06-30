/**
 * Cliente MCP para rdstationmentor.com
 * Auto-descobre as tools disponíveis via tools/list antes de chamar qualquer uma.
 */

const MCP_URL = 'https://mcp.rdstationmentor.com/crm/mcp?key=019ef10b-1d90-7f41-a943-d274c1c5571c'

let _msgId = 0
const nextId = () => ++_msgId

interface JsonRpcResp {
  id?: number
  result?: unknown
  error?: { code: number; message: string }
}

async function post(body: object): Promise<JsonRpcResp> {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`MCP HTTP ${res.status} ${res.statusText}: ${txt.slice(0, 300)}`)
  }

  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('text/event-stream')) {
    const text = await res.text()
    const line = text.split('\n').find(l => l.startsWith('data: '))
    if (!line) return {}
    return JSON.parse(line.slice(6)) as JsonRpcResp
  }

  return res.json() as Promise<JsonRpcResp>
}

// ── Cache de sessão (válido enquanto o processo Node estiver vivo) ─────────────
export interface MCPTool { name: string; description?: string }
let _tools: MCPTool[] | null = null

async function ensureReady(): Promise<MCPTool[]> {
  if (_tools !== null) return _tools

  // Inicialização obrigatória pelo protocolo MCP
  try {
    await post({
      jsonrpc: '2.0', id: nextId(), method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'nex-mkt-ops', version: '1.0' },
      },
    })
    // Notificação "initialized" (best-effort, alguns servidores exigem)
    await post({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }).catch(() => {})
  } catch (e) {
    console.warn('[mcp] initialize falhou (pode ser ignorável):', e instanceof Error ? e.message : e)
  }

  // Lista tools disponíveis
  const listRes = await post({ jsonrpc: '2.0', id: nextId(), method: 'tools/list', params: {} })
  const raw = (listRes.result as { tools?: MCPTool[] })?.tools
               ?? (listRes as { tools?: MCPTool[] }).tools
               ?? []
  _tools = Array.isArray(raw) ? raw : []
  console.log('[mcp] tools disponíveis:', _tools.map(t => t.name).join(', ') || '(nenhuma)')
  return _tools
}

function pickTool(tools: MCPTool[], keywords: string[]): string | null {
  const kw = keywords.map(k => k.toLowerCase())
  return tools.find(t => kw.some(k => t.name.toLowerCase().includes(k)))?.name ?? null
}

async function invokeTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T | null> {
  const res = await post({ jsonrpc: '2.0', id: nextId(), method: 'tools/call', params: { name, arguments: args } })
  if (res.error) throw new Error(`MCP tool '${name}': ${res.error.message}`)

  // Desempacota content (formato padrão MCP)
  const content = (res.result as { content?: Array<{ type: string; text: string }> })?.content
  const text = Array.isArray(content) ? content.find(c => c.type === 'text')?.text : null
  if (text) {
    try { return JSON.parse(text) as T } catch { return text as T }
  }

  // Alguns servidores retornam diretamente no result
  if (res.result && typeof res.result === 'object' && !Array.isArray(res.result)) {
    return res.result as T
  }
  return null
}

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface RDFunnel { _id: string; name: string }
export interface RDStage  { _id: string; name: string; deal_pipeline_id: string }
export interface RDDeal   {
  _id: string; name: string
  deal_stage_id: string; deal_pipeline_id: string
  created_at: string; updated_at: string
  win: boolean | null; hold: boolean | null
  amount_montly: number | null; amount_total: number | null
}

// ── Funções públicas ──────────────────────────────────────────────────────────

export async function listMCPTools(): Promise<MCPTool[]> {
  return ensureReady()
}

export async function listFunnelsMCP(): Promise<RDFunnel[]> {
  const tools = await ensureReady()
  const name = pickTool(tools, ['pipeline', 'funil', 'funnel', 'deal_pipeline'])
  if (!name) {
    console.warn('[mcp] nenhuma tool de funis encontrada. Tools:', tools.map(t => t.name))
    return []
  }
  const res = await invokeTool<RDFunnel[] | { deal_pipelines?: RDFunnel[]; pipelines?: RDFunnel[] }>(name)
  if (!res) return []
  if (Array.isArray(res)) return res
  return res.deal_pipelines ?? res.pipelines ?? []
}

export async function listStagesMCP(pipelineId: string): Promise<RDStage[]> {
  const tools = await ensureReady()
  const name = pickTool(tools, ['stage', 'etapa', 'pipeline_stage'])
  if (!name) return []
  const res = await invokeTool<RDStage[] | { deal_pipeline_stages?: RDStage[]; stages?: RDStage[] }>(
    name, { deal_pipeline_id: pipelineId, pipeline_id: pipelineId, id: pipelineId }
  )
  if (!res) return []
  if (Array.isArray(res)) return res
  return res.deal_pipeline_stages ?? res.stages ?? []
}

export async function listAllDealsMCP(pipelineId: string): Promise<RDDeal[]> {
  const tools = await ensureReady()
  const name = pickTool(tools, ['deal', 'negoc', 'oportunidade', 'opportunity'])
  if (!name) return []

  const all: RDDeal[] = []
  let page = 1
  const LIMIT = 200

  while (true) {
    const res = await invokeTool<RDDeal[] | { deals?: RDDeal[]; total?: number }>(
      name, { deal_pipeline_id: pipelineId, pipeline_id: pipelineId, page, limit: LIMIT, per_page: LIMIT }
    )
    if (!res) break

    const batch = Array.isArray(res) ? res : (res.deals ?? [])
    const total  = Array.isArray(res) ? undefined : res.total
    all.push(...batch)

    if (batch.length < LIMIT || (total !== undefined && all.length >= total)) break
    page++
    if (page > 50) break
  }
  return all
}
