/**
 * Cliente MCP para rdstationmentor.com (protocolo Streamable HTTP / JSON-RPC 2.0)
 *
 * Detalhes importantes do protocolo:
 *  - O servidor devolve um header `Mcp-Session-Id` na resposta de `initialize`.
 *    Esse id PRECISA ser reenviado em todas as requisições seguintes.
 *  - As respostas podem vir como JSON puro ou como SSE (text/event-stream).
 */

const MCP_URL = 'https://mcp.rdstationmentor.com/crm/mcp?key=019ef10b-1d90-7f41-a943-d274c1c5571c'
const PROTOCOL_VERSION = '2025-03-26'

let _msgId = 0
const nextId = () => ++_msgId

interface JsonRpcResp {
  id?: number
  result?: unknown
  error?: { code: number; message: string }
}

export interface RawCall {
  method: string
  status: number
  contentType: string
  sessionId: string | null
  body: string
}

interface PostResult { json: JsonRpcResp; raw: RawCall }

// ── Estado de sessão (vive enquanto o processo Node estiver vivo) ───────────────
let _sessionId: string | null = null

async function post(method: string, params: Record<string, unknown> | undefined, isNotification = false): Promise<PostResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'MCP-Protocol-Version': PROTOCOL_VERSION,
  }
  if (_sessionId) headers['Mcp-Session-Id'] = _sessionId

  const payload: Record<string, unknown> = { jsonrpc: '2.0', method }
  if (params !== undefined) payload.params = params
  if (!isNotification) payload.id = nextId()

  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  // Captura o session id quando o servidor o cria (resposta do initialize)
  const sid = res.headers.get('mcp-session-id') ?? res.headers.get('Mcp-Session-Id')
  if (sid) _sessionId = sid

  const contentType = res.headers.get('content-type') ?? ''
  const text = await res.text()

  const raw: RawCall = {
    method,
    status: res.status,
    contentType,
    sessionId: sid,
    body: text.slice(0, 2000),
  }

  let json: JsonRpcResp = {}
  if (text) {
    if (contentType.includes('text/event-stream')) {
      // Pega a última linha "data:" com payload JSON-RPC
      const dataLines = text.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim())
      for (const d of dataLines.reverse()) {
        try { json = JSON.parse(d); break } catch { /* continua */ }
      }
    } else {
      try { json = JSON.parse(text) } catch { /* mantém vazio */ }
    }
  }

  return { json, raw }
}

// ── Cache de tools ──────────────────────────────────────────────────────────────
export interface MCPTool { name: string; description?: string; inputSchema?: unknown }
let _tools: MCPTool[] | null = null
const _trace: RawCall[] = []

async function ensureReady(force = false): Promise<MCPTool[]> {
  if (_tools !== null && !force) return _tools
  _trace.length = 0

  // 1. initialize → cria sessão
  const init = await post('initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'nex-mkt-ops', version: '1.0' },
  })
  _trace.push(init.raw)

  // 2. notifications/initialized (sem id — é notificação)
  try {
    const notif = await post('notifications/initialized', {}, true)
    _trace.push(notif.raw)
  } catch { /* best effort */ }

  // 3. tools/list (já com Mcp-Session-Id)
  const list = await post('tools/list', {})
  _trace.push(list.raw)

  const raw = (list.json.result as { tools?: MCPTool[] })?.tools ?? []
  _tools = Array.isArray(raw) ? raw : []
  console.log('[mcp] tools:', _tools.map(t => t.name).join(', ') || '(nenhuma)')
  return _tools
}

function pickTool(tools: MCPTool[], keywords: string[]): string | null {
  const kw = keywords.map(k => k.toLowerCase())
  return tools.find(t => kw.some(k => t.name.toLowerCase().includes(k)))?.name ?? null
}

async function invokeTool<T>(name: string, args: Record<string, unknown> = {}): Promise<T | null> {
  const { json } = await post('tools/call', { name, arguments: args })
  if (json.error) throw new Error(`MCP tool '${name}': ${json.error.message}`)

  const content = (json.result as { content?: Array<{ type: string; text: string }> })?.content
  const text = Array.isArray(content) ? content.find(c => c.type === 'text')?.text : null
  if (text) {
    try { return JSON.parse(text) as T } catch { return text as unknown as T }
  }
  if (json.result && typeof json.result === 'object' && !Array.isArray(json.result)) {
    return json.result as T
  }
  return null
}

// ── Tipos exportados ────────────────────────────────────────────────────────────
export interface RDFunnel { _id: string; name: string }
export interface RDStage  { _id: string; name: string; deal_pipeline_id: string }
export interface RDDeal   {
  _id: string; name: string
  deal_stage_id: string; deal_pipeline_id: string
  created_at: string; updated_at: string
  win: boolean | null; hold: boolean | null
  amount_montly: number | null; amount_total: number | null
}

// ── Diagnóstico ───────────────────────────────────────────────────────────────
export async function probeMCP(): Promise<{ tools: MCPTool[]; trace: RawCall[]; sessionId: string | null }> {
  const tools = await ensureReady(true)
  return { tools, trace: [..._trace], sessionId: _sessionId }
}

export async function listMCPTools(): Promise<MCPTool[]> {
  return ensureReady()
}

// ── Funções de negócio ──────────────────────────────────────────────────────────
export async function listFunnelsMCP(): Promise<RDFunnel[]> {
  const tools = await ensureReady()
  const name = pickTool(tools, ['pipeline', 'funil', 'funnel', 'deal_pipeline'])
  if (!name) {
    console.warn('[mcp] nenhuma tool de funis. Tools:', tools.map(t => t.name))
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
