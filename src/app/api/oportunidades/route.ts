import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listFunnelsMCP, listStagesMCP, listDealsMCP, probeMCP, type RDDeal, type RDStage, type RDFunnel } from '@/lib/rdcrm-mcp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Funis de Escritório Privativo: [FCO] Escritório Privativo e [CPE] Escritório Privativo
function isEPFunnel(name: string) {
  const n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return n.includes('escritorio privativo')
}

// Etapa "Closer | Deal" (ou variantes) nos funis EP
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

  const { searchParams } = new URL(req.url)
  const de  = searchParams.get('de')  ?? undefined
  const ate = searchParams.get('ate') ?? undefined

  try {
    const funnels: RDFunnel[] = await listFunnelsMCP()
    console.log(`[oportunidades] ${funnels.length} funis via MCP:`, funnels.map(f => f.name).join(' | '))

    if (funnels.length === 0) {
      const diag = await probeMCP().catch(e => ({ error: e instanceof Error ? e.message : String(e) }))
      return NextResponse.json({ funnels: [], totalGeral: 0, totalCloser: 0, de, ate, diagnostico: diag })
    }

    const funnelData = await Promise.all(
      funnels.map(async (funnel) => {
        const [stages, rawDeals] = await Promise.all([
          listStagesMCP(funnel.id),
          listDealsMCP(funnel.id, de),   // RDQL já filtra created_at >= de
        ])

        const deals = filterByPeriod(rawDeals, de, ate)  // garante o limite superior (ate)
        const isEP  = isEPFunnel(funnel.name)
        const stageMap = Object.fromEntries(stages.map((s: RDStage) => [s.id, s.name]))

        const byStage: Record<string, number> = {}
        for (const s of stages) byStage[s.id] = 0
        for (const d of deals) {
          if (d.stage_id in byStage) byStage[d.stage_id]++
        }

        const closerStages    = stages.filter((s: RDStage) => isCloserDealStage(s.name))
        const closerStageIds  = new Set(closerStages.map((s: RDStage) => s.id))
        const closerStageName = closerStages[0]?.name ?? null
        const closerDeals     = isEP ? deals.filter(d => closerStageIds.has(d.stage_id)) : []

        const sortedDeals = [...deals].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )

        return {
          id: funnel.id,
          name: funnel.name,
          isEP,
          total: deals.length,
          closerCount: isEP ? closerDeals.length : null,
          closerStageName,
          byStage: stages.map((s: RDStage) => ({
            stageName: s.name,
            count: byStage[s.id] ?? 0,
            isCloser: isCloserDealStage(s.name),
          })),
          byMonth: groupByMonth(deals),
          allDeals: sortedDeals.slice(0, 100).map(d => ({
            id: d.id,
            name: d.name,
            stage: stageMap[d.stage_id] ?? 'Desconhecido',
            isCloser: closerStageIds.has(d.stage_id),
            created_at: d.created_at,
            win: d.status === 'won' ? true : d.status === 'lost' ? false : null,
          })),
          closerDeals: closerDeals.slice(0, 100).map(d => ({
            id: d.id,
            name: d.name,
            stage: stageMap[d.stage_id] ?? '',
            created_at: d.created_at,
          })),
        }
      })
    )

    const totalGeral  = funnelData.reduce((s, f) => s + f.total, 0)
    const totalCloser = funnelData
      .filter(f => f.isEP)
      .reduce((s, f) => s + (f.closerCount ?? 0), 0)

    return NextResponse.json({ funnels: funnelData, totalGeral, totalCloser, de, ate })
  } catch (e) {
    console.error('[oportunidades] erro:', e instanceof Error ? e.message : e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao buscar dados via MCP' },
      { status: 500 }
    )
  }
}
