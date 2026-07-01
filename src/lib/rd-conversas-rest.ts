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
 * Probe abrangente de AUTENTICAÇÃO: testa o token em vários headers E na query
 * string, tudo contra /messages/history?page=1&limit=1, e reporta o status de
 * cada combinação. Revela em uma única chamada onde o token deve ir.
 */
export async function probeConversasRest(_de: string, _ate: string) {
  const base = getConversasApiBase()
  const token = getConversasToken()
  const path = '/messages/history'

  const headerCombos: { rotulo: string; headers: Record<string, string> }[] = [
    { rotulo: 'header:x-access-token', headers: { 'x-access-token': token } },
    { rotulo: 'header:access-token', headers: { 'access-token': token } },
    { rotulo: 'header:Authorization Bearer', headers: { Authorization: `Bearer ${token}` } },
    { rotulo: 'header:Authorization raw', headers: { Authorization: token } },
    { rotulo: 'header:token', headers: { token } },
    { rotulo: 'header:x-token', headers: { 'x-token': token } },
    { rotulo: 'header:api-token', headers: { 'api-token': token } },
    { rotulo: 'header:apitoken', headers: { apitoken: token } },
    { rotulo: 'header:x-api-key', headers: { 'x-api-key': token } },
  ]

  const queryCombos: { rotulo: string; qs: string }[] = [
    { rotulo: 'query:access-token', qs: `access-token=${encodeURIComponent(token)}` },
    { rotulo: 'query:token', qs: `token=${encodeURIComponent(token)}` },
    { rotulo: 'query:access_token', qs: `access_token=${encodeURIComponent(token)}` },
    { rotulo: 'query:apitoken', qs: `apitoken=${encodeURIComponent(token)}` },
  ]

  const resultados: { combo: string; status: number; body: string }[] = []

  async function testar(rotulo: string, url: string, headers: Record<string, string>) {
    try {
      const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json', ...headers }, cache: 'no-store' })
      const body = (await res.text()).slice(0, 400)
      resultados.push({ combo: rotulo, status: res.status, body })
    } catch (e) {
      resultados.push({ combo: rotulo, status: 0, body: e instanceof Error ? e.message : 'erro' })
    }
  }

  for (const c of headerCombos) {
    await testar(c.rotulo, `${base}${path}?page=1&limit=1`, c.headers)
  }
  for (const c of queryCombos) {
    await testar(c.rotulo, `${base}${path}?page=1&limit=1&${c.qs}`, {})
  }

  const vencedor = resultados.find(r => r.status !== 401 && r.status !== 403 && r.status !== 0)

  return { base, vencedor: vencedor?.combo ?? null, resultados }
}
