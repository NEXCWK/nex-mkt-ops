const BASE = 'https://crm.rdstation.com/api/v1'

function token() {
  const t = process.env.RDCRM_TOKEN
  if (!t) throw new Error('RDCRM_TOKEN não configurado no ambiente.')
  return t
}

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams({ token: token() })
  Object.entries(params).forEach(([k, v]) => qs.set(k, String(v)))
  const url = `${BASE}${path}?${qs.toString()}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[rdcrm] ${path} → HTTP ${res.status} ${res.statusText}`, body.slice(0, 200))
    throw new Error(`RD CRM ${path} → ${res.status} ${res.statusText}`)
  }
  const json = await res.json()
  console.log(`[rdcrm] ${path} keys:`, Object.keys(json as object))
  return json as T
}

export interface RDFunnel {
  _id: string
  name: string
}

export interface RDStage {
  _id: string
  name: string
  deal_pipeline_id: string
}

export interface RDDeal {
  _id: string
  name: string
  deal_stage_id: string
  deal_pipeline_id: string
  created_at: string
  updated_at: string
  win: boolean | null
  hold: boolean | null
  amount_montly: number | null
  amount_total: number | null
  user?: { name: string }
}

interface FunnelsResponse { deal_pipelines: RDFunnel[] }
interface StagesResponse  { deal_pipeline_stages: RDStage[] }
interface DealsResponse   { deals: RDDeal[]; total: number }

export async function listFunnels(): Promise<RDFunnel[]> {
  const raw = await get<Record<string, unknown>>('/deal_pipelines')
  // A API pode retornar 'deal_pipelines' (array) diretamente
  const list = (raw.deal_pipelines as RDFunnel[] | undefined) ?? []
  console.log(`[rdcrm] listFunnels → ${list.length} funis`)
  if (list.length === 0) console.warn('[rdcrm] listFunnels retornou vazio. Resposta bruta:', JSON.stringify(raw).slice(0, 300))
  return list
}

export async function listStages(funnelId: string): Promise<RDStage[]> {
  const data = await get<StagesResponse>('/deal_pipeline_stages', { deal_pipeline_id: funnelId })
  return data.deal_pipeline_stages ?? []
}

/** Busca TODAS as negociações de um funil (itera páginas automaticamente). */
export async function listAllDeals(funnelId: string): Promise<RDDeal[]> {
  const LIMIT = 200
  const all: RDDeal[] = []
  let page = 1
  while (true) {
    const data = await get<DealsResponse>('/deals', {
      deal_pipeline_id: funnelId,
      page,
      limit: LIMIT,
    })
    const batch = data.deals ?? []
    all.push(...batch)
    // Para quando não há mais resultados ou atingiu o total declarado
    if (batch.length < LIMIT || all.length >= (data.total ?? 0)) break
    page++
    if (page > 50) break // safety cap: máx 10.000 negociações por funil
  }
  return all
}
