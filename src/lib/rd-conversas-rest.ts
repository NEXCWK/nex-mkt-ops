/**
 * Integração com o RD Station Conversas via API REST v2 (plataforma Tallos).
 *
 * Endpoint de histórico de conversas: GET {BASE}/messages/history
 * Base padrão: https://api.tallos.com.br/v2
 * Autenticação: token (JWT) — testamos "Authorization: Bearer" e "access-token".
 *
 * Observação: o endpoint de histórico consta como recurso do plano Advanced.
 * Em planos inferiores a API pode responder 401/402/403.
 */

export function getConversasApiBase(): string {
  return (process.env.RD_CONVERSAS_API_URL || 'https://api.tallos.com.br/v2').replace(/\/$/, '')
}

export function getConversasToken(): string {
  const t = process.env.RD_CONVERSAS_TOKEN
  if (!t) throw new Error('RD_CONVERSAS_TOKEN não configurado no ambiente (Railway).')
  return t
}

export interface RestCall {
  url: string
  authStyle: string
  status: number
  contentType: string
  body: string
}

// Estilos de autenticação a testar (o que funcionar é memorizado).
// 'x-access-token' é o mais provável: a resposta {auth:false,"No token provided."}
// é a assinatura do middleware JWT em Node que lê req.headers['x-access-token'].
type AuthStyle = 'x-access-token' | 'access-token' | 'bearer' | 'token' | 'x-token' | 'authorization-token'
let _authOk: AuthStyle | null = null

function authHeaders(style: AuthStyle, token: string): Record<string, string> {
  switch (style) {
    case 'x-access-token': return { 'x-access-token': token }
    case 'access-token': return { 'access-token': token }
    case 'bearer': return { Authorization: `Bearer ${token}` }
    case 'token': return { token }
    case 'x-token': return { 'x-token': token }
    case 'authorization-token': return { Authorization: token }
  }
}

/** GET com auto-detecção do cabeçalho de autenticação. Retorna resposta crua + parse. */
export async function apiGet(path: string, params: Record<string, string | number> = {}): Promise<{
  ok: boolean
  status: number
  json: unknown
  raw: RestCall
}> {
  const base = getConversasApiBase()
  const token = getConversasToken()
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => qs.set(k, String(v)))
  const url = `${base}${path}${qs.toString() ? `?${qs}` : ''}`

  // Autenticação confirmada: Authorization: Bearer. Mantemos fallback por segurança.
  const styles: AuthStyle[] = _authOk
    ? [_authOk]
    : ['bearer', 'x-access-token', 'access-token', 'token', 'x-token', 'authorization-token']
  let last: RestCall = { url, authStyle: 'none', status: 0, contentType: '', body: '' }

  for (const style of styles) {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...authHeaders(style, token) },
      cache: 'no-store',
    })
    const contentType = res.headers.get('content-type') ?? ''
    const text = await res.text()
    last = { url, authStyle: style, status: res.status, contentType, body: text.slice(0, 3000) }

    // "No token provided" = formato de auth errado → tenta o próximo estilo.
    // Qualquer outra resposta (inclusive 403 de plano) significa que o token foi aceito.
    const semToken = res.status === 401 || /no token provided/i.test(text)
    if (semToken) continue

    _authOk = style // memoriza o estilo que o servidor aceitou
    let json: unknown = null
    try { json = JSON.parse(text) } catch { /* não-JSON */ }
    return { ok: res.ok, status: res.status, json, raw: last }
  }

  return { ok: false, status: last.status, json: null, raw: last }
}

/**
 * Probe de ENDPOINTS: com a auth confirmada (Authorization: Bearer), varre vários
 * endpoints candidatos de conversa/mensagem para descobrir se ALGUM é acessível no
 * plano atual (o /messages/history é Advanced-only). Reporta status + corpo de cada.
 */
export async function probeConversasRest(_de: string, _ate: string) {
  const base = getConversasApiBase()
  const token = getConversasToken()
  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` }

  // endpoints candidatos que poderiam conter conteúdo de conversas/mensagens
  const endpoints = [
    '/messages/history',
    '/messages',
    '/conversations',
    '/conversations/history',
    '/tickets',
    '/attendances',
    '/atendimentos',
    '/chats',
    '/reports',
    '/contacts',
    '/employees',
  ]

  const resultados: { endpoint: string; status: number; body: string }[] = []

  for (const ep of endpoints) {
    const url = `${base}${ep}?page=1&limit=1`
    try {
      const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' })
      const body = (await res.text()).slice(0, 350)
      resultados.push({ endpoint: ep, status: res.status, body })
    } catch (e) {
      resultados.push({ endpoint: ep, status: 0, body: e instanceof Error ? e.message : 'erro' })
    }
  }

  // acessíveis = status 2xx (token aceito e recurso liberado no plano)
  const acessiveis = resultados.filter(r => r.status >= 200 && r.status < 300).map(r => r.endpoint)

  return { base, authConfirmada: 'Authorization: Bearer', acessiveis, resultados }
}
