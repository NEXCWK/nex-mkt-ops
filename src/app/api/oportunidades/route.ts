import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listFunnels, listStages, listAllDeals, type RDDeal, type RDStage } from '@/lib/rdcrm'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Funis de Escritório Privativo: detectados por "escritório privativo" no nome
function isEPFunnel(name: string) {
  const n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return n.includes('escritorio privativo')
}

// Etapa "Closer | Deal" (ou variantes) no funil EP
function isCloserDealStage(name: string) {
  const n = name.trim().toLowerCase()
  return (
    n === 'deals' ||
    n === 'deal' ||
    n === 'closer | deal' ||
    n === 'closer | deals' ||
    (n.includes('closer') && n.includes('deal'))
  )
}

function groupByMonth(deals: RDDeal[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const d of deals) {
    const month = d.created_at?.slice(0, 7) ?? 'unknown'
    counts[month] = (counts[month] ?? 0) + 1
  }
  return counts
}

function filterByPeriod(deals: RDDeal[], de?: string, ate?: string): RDDeal[] {
  if (!de && !ate) return deals
  return deals.filter(d => {
    const dt = d.created_at?.slice(0, 10) ?? ''
    if (de && dt < de) return false
    if (ate && dt > ate) return false
    return true
  })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!process.env.RDCRM_TOKEN) {
    return NextResponse.json(
      { error: 'RDCRM_TOKEN não configurado. Adicione a variável no Railway.' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(req.url)
  const de  = searchParams.get('de')  ?? undefined   // YYYY-MM-DD
  const ate = searchParams.get('ate') ?? undefined   // YYYY-MM-DD

  try {
    const funnels = await listFunnels()
    console.log(`[oportunidades] ${funnels.length} funis encontrados`)

    const funnelData = await Promise.all(
      funnels.map(async (funnel) => {
        const [stages, allDeals] = await Promise.all([
          listStages(funnel._id),
          listAllDeals(funnel._id),
        ])

        // Filtra pelo período APÓS buscar tudo (mais simples e seguro)
        const deals = filterByPeriod(allDeals, de, ate)

        const isEP = isEPFunnel(funnel.name)
        const stageMap = Object.fromEntries(stages.map((s: RDStage) => [s._id, s.name]))

        // Conta por etapa
        const byStage: Record<string, number> = {}
        for (const s of stages) byStage[s._id] = 0
        for (const d of deals) {
          if (d.deal_stage_id in byStage) byStage[d.deal_stage_id]++
        }

        // Etapa Closer | Deal
        const closerStages = stages.filter((s: RDStage) => isCloserDealStage(s.name))
        const closerStageIds = new Set(closerStages.map((s: RDStage) => s._id))
        const closerStageName = closerStages[0]?.name ?? null
        const closerDeals = isEP
          ? deals.filter(d => closerStageIds.has(d.deal_stage_id))
          : []

        const sortedDeals = [...deals].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )

        return {
          id: funnel._id,
          name: funnel.name,
          isEP,
          total: deals.length,
          closerCount: isEP ? closerDeals.length : null,
          closerStageName,
          byStage: stages.map((s: RDStage) => ({
            stageName: s.name,
            count: byStage[s._id] ?? 0,
            isCloser: isCloserDealStage(s.name),
          })),
          byMonth: groupByMonth(deals),
          allDeals: sortedDeals.slice(0, 100).map(d => ({
            id: d._id,
            name: d.name,
            stage: stageMap[d.deal_stage_id] ?? 'Desconhecido',
            isCloser: closerStageIds.has(d.deal_stage_id),
            created_at: d.created_at,
            win: d.win,
          })),
          closerDeals: closerDeals.slice(0, 100).map(d => ({
            id: d._id,
            name: d.name,
            stage: stageMap[d.deal_stage_id] ?? '',
            created_at: d.created_at,
          })),
        }
      })
    )

    const totalGeral = funnelData.reduce((s, f) => s + f.total, 0)
    const totalCloser = funnelData
      .filter(f => f.isEP)
      .reduce((s, f) => s + (f.closerCount ?? 0), 0)

    return NextResponse.json({
      funnels: funnelData,
      totalGeral,
      totalCloser,
      de,
      ate,
      _meta: { funnelCount: funnels.length },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao buscar dados do RD CRM' },
      { status: 500 }
    )
  }
}
