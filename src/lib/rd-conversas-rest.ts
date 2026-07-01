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

// Estilos de autenticação a testar (o que funcionar é memorizado)
type AuthStyle = 'bearer' | 'access-token' | 'token'
let _authOk: AuthStyle | null = null

function authHeaders(style: AuthStyle, token: string): Record<string, string> {
  switch (style) {
    case 'bearer': return { Authorization: `Bearer ${token}` }
    case 'access-token': return { 'access-token': token }
    case 'token': return { Authorization: token }
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

  const styles: AuthStyle[] = _authOk ? [_authOk] : ['bearer', 'access-token', 'token']
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

    if (res.status === 401 || res.status === 403) continue // tenta o próximo estilo de auth

    if (res.ok) _authOk = style
    let json: unknown = null
    try { json = JSON.parse(text) } catch { /* não-JSON */ }
    return { ok: res.ok, status: res.status, json, raw: last }
  }

  return { ok: false, status: last.status, json: null, raw: last }
}

/** Probe: chama /messages/history com uma janela pequena e devolve a resposta crua. */
export async function probeConversasRest(de: string, ate: string) {
  const tentativas: RestCall[] = []
  // testa nomes de parâmetros de data mais comuns
  const paramVariants: Record<string, string>[] = [
    { start: de, end: ate },
    { startDate: de, endDate: ate },
    { start_date: de, end_date: ate },
    { from: de, to: ate },
    { initialDate: de, finalDate: ate },
    {},
  ]
  for (const variant of paramVariants) {
    const { raw, ok } = await apiGet('/messages/history', { ...variant, page: 1, limit: 20 })
    tentativas.push(raw)
    if (ok) break
  }
  return { base: getConversasApiBase(), authDetectado: _authOk, tentativas }
}
