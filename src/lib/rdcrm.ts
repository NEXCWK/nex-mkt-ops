const BASE = 'https://crm.rdstation.com/api/v1'

function token() {
  const t = process.env.RDCRM_TOKEN
  if (!t) throw new Error('RDCRM_TOKEN não configurado no ambiente.')
  return t
}

async function get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams({ token: token() })
  Object.entries(params).forEach(([k, v]) => qs.set(k, String(v)))
  const res = await fetch(`${BASE}${path}?${qs.toString()}`, {
    next: { revalidate: 120 }, // cache 2 min
  })
  if (!res.ok) throw new Error(`RD CRM ${path} → ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
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
interface DealsResponse   { deals: RDDeal[]; total: number; next_page?: number }

export async function listFunnels(): Promise<RDFunnel[]> {
  const data = await get<FunnelsResponse>('/deal_pipelines')
  return data.deal_pipelines ?? []
}

export async function listStages(funnelId: string): Promise<RDStage[]> {
  const data = await get<StagesResponse>('/deal_pipeline_stages', { deal_pipeline_id: funnelId })
  return data.deal_pipeline_stages ?? []
}

/** Busca TODAS as negociações de um funil (itera páginas automaticamente). */
export async function listAllDeals(funnelId: string): Promise<RDDeal[]> {
  const all: RDDeal[] = []
  let page = 1
  while (true) {
    const data = await get<DealsResponse>('/deals', {
      deal_pipeline_id: funnelId,
      page,
      limit: 200,
    })
    all.push(...(data.deals ?? []))
    if (!data.next_page || data.deals?.length === 0) break
    page = data.next_page
    if (page > 50) break // safety cap
  }
  return all
}
