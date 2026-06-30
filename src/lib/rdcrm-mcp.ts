/**
 * Cliente MCP para o RD Station CRM (servidor rdstationmentor.com).
 * O servidor expõe a API v2 do RD CRM (https://api.rd.services/crm/v2) via MCP.
 *
 * Tools usadas:
 *  - funnel_list           → lista funis (pipelines)
 *  - funnel_stages_list    → etapas de um funil (requer pipeline_id)
 *  - deals_list            → negociações, com filtro RDQL e paginação page:{size,number}
 *
 * Protocolo: MCP Streamable HTTP (JSON-RPC 2.0). As respostas vêm como SSE
 * (text/event-stream). Este servidor NÃO usa Mcp-Session-Id.
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
  body: string
}

interface PostResult { json: JsonRpcResp; raw: RawCall }

async function post(method: string, params: Record<string, unknown> | undefined, isNotification = false): Promise<PostResult> {
  const payload: Record<string, unknown> = { jsonrpc: '2.0', method }
  if (params !== undefined) payload.params = params
  if (!isNotification) payload.id = nextId()

  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'MCP-Protocol-Version': PROTOCOL_VERSION,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  const contentType = res.headers.get('content-type') ?? ''
  const text = await res.text()
  const raw: RawCall = { method, status: res.status, contentType, body: text.slice(0, 1500) }

  let json: JsonRpcResp = {}
  if (text) {
    if (contentType.includes('text/event-stream')) {
      const dataLines = text.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim())
      for (const d of dataLines.reverse()) {
        try { json = JSON.parse(d); break } catch { /* tenta a próxima */ }
      }
    } else {
      try { json = JSON.parse(text) } catch { /* vazio */ }
    }
  }
  return { json, raw }
}

// ── Sessão MCP (apenas handshake; este servidor não exige session id) ───────────
let _ready = false
const _trace: RawCall[] = []

async function ensureReady(force = false): Promise<void> {
  if (_ready && !force) return
  _trace.length = 0

  const init = await post('initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'nex-mkt-ops', version: '1.0' },
  })
  _trace.push(init.raw)

  try {
    const notif = await post('notifications/initialized', {}, true)
    _trace.push(notif.raw)
  } catch { /* best effort */ }

  _ready = true
}

async function invokeTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T | null> {
  await ensureReady()
  const { json, raw } = await post('tools/call', { name, arguments: args })
  if (_trace.length < 40) _trace.push(raw)
  if (json.error) throw new Error(`MCP tool '${name}': ${json.error.message}`)

  const content = (json.result as { content?: Array<{ type: string; text: string }> })?.content
  const text = Array.isArray(content) ? content.find(c => c.type === 'text')?.text : null
  if (text) {
    try { return JSON.parse(text) as T } catch { return text as unknown as T }
  }
  if (json.result && typeof json.result === 'object') return json.result as T
  return null
}

// ── Helpers de extração ─────────────────────────────────────────────────────────
function firstArray(obj: unknown, keys: string[]): unknown[] {
  if (Array.isArray(obj)) return obj
  if (!obj || typeof obj !== 'object') return []
  const rec = obj as Record<string, unknown>
  for (const k of keys) if (Array.isArray(rec[k])) return rec[k] as unknown[]
  for (const v of Object.values(rec)) if (Array.isArray(v)) return v as unknown[]
  return []
}

// ── Tipos exportados ────────────────────────────────────────────────────────────
export interface RDFunnel { id: string; name: string }
export interface RDStage  { id: string; name: string; pipeline_id: string; order?: number }
export interface RDDeal   {
  id: string; name: string
  stage_id: string; pipeline_id: string
  created_at: string
  status: string | null
}

function normFunnel(o: Record<string, unknown>): RDFunnel {
  return {
    id: String(o.id ?? o._id ?? ''),
    name: String(o.name ?? ''),
  }
}

function normStage(o: Record<string, unknown>): RDStage {
  return {
    id: String(o.id ?? o._id ?? ''),
    name: String(o.name ?? ''),
    pipeline_id: String(o.pipeline_id ?? o.deal_pipeline_id ?? ''),
    order: typeof o.order === 'number' ? o.order : undefined,
  }
}

function normDeal(o: Record<string, unknown>): RDDeal {
  const stage = o.stage as Record<string, unknown> | undefined
  const pipeline = o.pipeline as Record<string, unknown> | undefined
  return {
    id: String(o.id ?? o._id ?? ''),
    name: String(o.name ?? ''),
    stage_id: String(o.stage_id ?? o.deal_stage_id ?? stage?.id ?? stage?._id ?? ''),
    pipeline_id: String(o.pipeline_id ?? o.deal_pipeline_id ?? pipeline?.id ?? ''),
    created_at: String(o.created_at ?? ''),
    status: (o.status as string) ?? null,
  }
}

// ── Diagnóstico ───────────────────────────────────────────────────────────────
export interface MCPTool { name: string; description?: string }

export async function probeMCP(): Promise<{ tools: MCPTool[]; trace: RawCall[] }> {
  await ensureReady(true)
  const list = await post('tools/list', {})
  _trace.push(list.raw)
  const tools = ((list.json.result as { tools?: MCPTool[] })?.tools ?? []) as MCPTool[]
  return { tools, trace: [..._trace] }
}

// ── Funções de negócio ──────────────────────────────────────────────────────────
export async function listFunnelsMCP(): Promise<RDFunnel[]> {
  const res = await invokeTool('funnel_list', { page: { size: 200, number: 1 } })
  const arr = firstArray(res, ['pipelines', 'funnels', 'funnel', 'data', 'items', 'records'])
  return arr.map(o => normFunnel(o as Record<string, unknown>)).filter(f => f.id)
}

export async function listStagesMCP(pipelineId: string): Promise<RDStage[]> {
  const res = await invokeTool('funnel_stages_list', {
    pipeline_id: pipelineId,
    page: { size: 200, number: 1 },
  })
  const arr = firstArray(res, ['stages', 'funnel_stages', 'data', 'items', 'records'])
  return arr.map(o => normStage(o as Record<string, unknown>)).filter(s => s.id)
}

/**
 * Busca negociações de um funil. Usa filtro RDQL para limitar por data de criação
 * (reduz o volume) e pagina via page:{size,number}.
 */
export async function listDealsMCP(pipelineId: string, de?: string): Promise<RDDeal[]> {
  const all: RDDeal[] = []
  const size = 200
  let number = 1

  // RDQL: filtros separados por espaço = AND implícito
  let filter = `pipeline_id:${pipelineId}`
  if (de) filter += ` created_at:>=${de}`

  while (true) {
    const res = await invokeTool('deals_list', {
      filter,
      page: { size, number },
    })
    const arr = firstArray(res, ['deals', 'data', 'items', 'records'])
    const batch = arr.map(o => normDeal(o as Record<string, unknown>)).filter(d => d.id)
    all.push(...batch)

    if (arr.length < size) break
    number++
    if (number > 50) break // teto de segurança: 10.000 negociações por funil
  }
  return all
}

// Alias para compatibilidade com a rota
export const listAllDealsMCP = listDealsMCP
