import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listFunnels, listStages, listAllDeals, type RDDeal, type RDStage } from '@/lib/rdcrm'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Funis de Escritório Privativo confirmados no RD CRM:
// "[FCO] Escritório Privativo" e "[CPE] Escritório Privativo"
// Detectados pelo sufixo "escritório privativo" (case-insensitive, ignora acento)
function isEPFunnel(name: string) {
  const n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return n.includes('escritorio privativo')
}

// Coluna "Deals" no funil de EP: correspondência exata ou prefixo "[…] Deals"
function isDealsStage(name: string) {
  const n = name.trim().toLowerCase()
  return n === 'deals' || n.endsWith('] deals') || n.startsWith('deals')
}

function groupByMonth(deals: RDDeal[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const d of deals) {
    const month = d.created_at?.slice(0, 7) ?? 'unknown'
    counts[month] = (counts[month] ?? 0) + 1
  }
  return counts
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!process.env.RDCRM_TOKEN) {
    return NextResponse.json(
      { error: 'RDCRM_TOKEN não configurado. Adicione a variável no Railway.' },
      { status: 500 }
    )
  }

  try {
    const funnels = await listFunnels()

    const funnelData = await Promise.all(
      funnels.map(async (funnel) => {
        const [stages, deals] = await Promise.all([
          listStages(funnel._id),
          listAllDeals(funnel._id),
        ])

        const isEP = isEPFunnel(funnel.name)
        const dealsStageIds = isEP
          ? stages.filter((s: RDStage) => isDealsStage(s.name)).map((s: RDStage) => s._id)
          : []

        const stageMap = Object.fromEntries(stages.map((s: RDStage) => [s._id, s.name]))

        const byStage: Record<string, { stageName: string; count: number; deals: RDDeal[] }> = {}
        for (const stage of stages) {
          byStage[stage._id] = { stageName: stage.name, count: 0, deals: [] }
        }
        for (const deal of deals) {
          if (byStage[deal.deal_stage_id]) {
            byStage[deal.deal_stage_id].count++
            byStage[deal.deal_stage_id].deals.push(deal)
          }
        }

        const dealsCount = isEP
          ? deals.filter(d => dealsStageIds.includes(d.deal_stage_id)).length
          : null

        return {
          id: funnel._id,
          name: funnel.name,
          isEP,
          total: deals.length,
          dealsCount,
          byStage: Object.values(byStage).map(s => ({
            stageName: s.stageName,
            count: s.count,
          })),
          byMonth: groupByMonth(deals),
          stageMap,
          recentDeals: deals
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 30)
            .map(d => ({
              id: d._id,
              name: d.name,
              stage: stageMap[d.deal_stage_id] ?? 'Desconhecido',
              created_at: d.created_at,
              win: d.win,
              amount: d.amount_montly,
            })),
        }
      })
    )

    const totalGeral = funnelData.reduce((s, f) => s + f.total, 0)

    return NextResponse.json({ funnels: funnelData, totalGeral })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao buscar dados do RD CRM' },
      { status: 500 }
    )
  }
}
