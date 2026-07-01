/**
 * Cliente MCP genérico (Streamable HTTP / JSON-RPC 2.0).
 * Reutilizável para qualquer servidor MCP (RD CRM, RD Conversas, etc.).
 *
 * Uso:
 *   const mcp = createMcpClient(process.env.RD_CONVERSAS_MCP_URL!)
 *   const tools = await mcp.listTools()
 *   const res = await mcp.callTool('nome_da_tool', { ... })
 */

const PROTOCOL_VERSION = '2025-03-26'

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

export interface MCPTool {
  name: string
  description?: string
  inputSchema?: unknown
}

export interface McpClient {
  listTools(force?: boolean): Promise<MCPTool[]>
  callTool<T = unknown>(name: string, args?: Record<string, unknown>): Promise<T | null>
  probe(): Promise<{ tools: MCPTool[]; trace: RawCall[] }>
  /** Escolhe a primeira tool cujo nome contém alguma das palavras-chave. */
  pickTool(keywords: string[]): Promise<string | null>
}

export function createMcpClient(url: string): McpClient {
  let msgId = 0
  const nextId = () => ++msgId
  let sessionId: string | null = null
  let ready = false
  let tools: MCPTool[] | null = null
  const trace: RawCall[] = []

  async function post(method: string, params?: Record<string, unknown>, isNotification = false): Promise<JsonRpcResp> {
    const payload: Record<string, unknown> = { jsonrpc: '2.0', method }
    if (params !== undefined) payload.params = params
    if (!isNotification) payload.id = nextId()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': PROTOCOL_VERSION,
    }
    if (sessionId) headers['Mcp-Session-Id'] = sessionId

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), cache: 'no-store' })

    const sid = res.headers.get('mcp-session-id') ?? res.headers.get('Mcp-Session-Id')
    if (sid) sessionId = sid

    const contentType = res.headers.get('content-type') ?? ''
    const text = await res.text()
    if (trace.length < 40) trace.push({ method, status: res.status, contentType, body: text.slice(0, 1500) })

    let json: JsonRpcResp = {}
    if (text) {
      if (contentType.includes('text/event-stream')) {
        const dataLines = text.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim())
        for (const d of dataLines.reverse()) {
          try { json = JSON.parse(d); break } catch { /* próxima */ }
        }
      } else {
        try { json = JSON.parse(text) } catch { /* vazio */ }
      }
    }
    return json
  }

  async function ensureReady(force = false): Promise<void> {
    if (ready && !force) return
    trace.length = 0
    await post('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'nex-mkt-ops', version: '1.0' },
    })
    try { await post('notifications/initialized', {}, true) } catch { /* best effort */ }
    ready = true
  }

  async function listTools(force = false): Promise<MCPTool[]> {
    if (tools !== null && !force) return tools
    await ensureReady(force)
    const res = await post('tools/list', {})
    const raw = (res.result as { tools?: MCPTool[] })?.tools ?? []
    tools = Array.isArray(raw) ? raw : []
    return tools
  }

  async function callTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T | null> {
    await ensureReady()
    const res = await post('tools/call', { name, arguments: args })
    if (res.error) throw new Error(`MCP tool '${name}': ${res.error.message}`)

    const content = (res.result as { content?: Array<{ type: string; text: string }> })?.content
    const text = Array.isArray(content) ? content.find(c => c.type === 'text')?.text : null
    if (text) {
      try { return JSON.parse(text) as T } catch { return text as unknown as T }
    }
    if (res.result && typeof res.result === 'object') return res.result as T
    return null
  }

  async function pickTool(keywords: string[]): Promise<string | null> {
    const list = await listTools()
    const kw = keywords.map(k => k.toLowerCase())
    return list.find(t => kw.some(k => t.name.toLowerCase().includes(k)))?.name ?? null
  }

  async function probe(): Promise<{ tools: MCPTool[]; trace: RawCall[] }> {
    const t = await listTools(true)
    return { tools: t, trace: [...trace] }
  }

  return { listTools, callTool, probe, pickTool }
}

/** Extrai o primeiro array encontrado numa resposta, testando chaves conhecidas. */
export function firstArray(obj: unknown, keys: string[]): unknown[] {
  if (Array.isArray(obj)) return obj
  if (!obj || typeof obj !== 'object') return []
  const rec = obj as Record<string, unknown>
  for (const k of keys) if (Array.isArray(rec[k])) return rec[k] as unknown[]
  for (const v of Object.values(rec)) if (Array.isArray(v)) return v as unknown[]
  return []
}
