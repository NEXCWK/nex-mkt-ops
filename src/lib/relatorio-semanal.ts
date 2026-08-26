import { createServerClient } from '@/lib/supabase/server'
import { listFunnelsMCP, listStagesMCP, listDealsMCP, type RDDeal, type RDStage } from '@/lib/rdcrm-mcp'

// ── Períodos ─────────────────────────────────────────────────────────────────

export interface Periodo {
  de: string
  ate: string
  label: string
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, dias: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return toISO(d)
}

function segundaDaSemana(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const dia = d.getDay() // 0=domingo .. 6=sábado
  const diff = dia === 0 ? -6 : 1 - dia
  return addDays(iso, diff)
}

function primeiroDiaDoMes(iso: string): string {
  return iso.slice(0, 7) + '-01'
}

function diasNoMes(ano: number, mes1a12: number): number {
  return new Date(ano, mes1a12, 0).getDate()
}

/** Mesmo "corte" (dia do mês) do mês anterior ao de `iso`, com clamp para meses mais curtos. */
function diaEquivalenteMesAnterior(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const mesAnterior = mes === 1 ? 12 : mes - 1
  const anoDoMesAnterior = mes === 1 ? ano - 1 : ano
  const diaClamped = Math.min(dia, diasNoMes(anoDoMesAnterior, mesAnterior))
  return `${anoDoMesAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(diaClamped).padStart(2, '0')}`
}

/**
 * Calcula os 5 períodos do relatório semanal a partir da data de referência
 * (o dia em que o relatório é gerado — normalmente uma segunda-feira).
 */
export function calcularPeriodos(hojeIso: string) {
  const segundaAtual = segundaDaSemana(hojeIso)

  const semanaPassada: Periodo = {
    de: addDays(segundaAtual, -7),
    ate: addDays(segundaAtual, -1),
    label: 'Semana passada',
  }
  const semanaRetrasada: Periodo = {
    de: addDays(segundaAtual, -14),
    ate: addDays(segundaAtual, -8),
    label: 'Semana retrasada',
  }
  const semanaCorrespondenteMesAnterior: Periodo = {
    de: addDays(semanaPassada.de, -28),
    ate: addDays(semanaPassada.ate, -28),
    label: 'Semana correspondente (mês anterior)',
  }
  const mesAtual: Periodo = {
    de: primeiroDiaDoMes(semanaPassada.ate),
    ate: semanaPassada.ate,
    label: 'Mês atual (até a semana passada)',
  }
  const mesAnterior: Periodo = {
    de: primeiroDiaDoMes(diaEquivalenteMesAnterior(semanaPassada.ate)),
    ate: diaEquivalenteMesAnterior(semanaPassada.ate),
    label: 'Mês anterior (mesmo intervalo de dias)',
  }

  return { semanaPassada, semanaRetrasada, semanaCorrespondenteMesAnterior, mesAtual, mesAnterior }
}

// ── Coleta de métricas ───────────────────────────────────────────────────────

export interface MetricasPeriodo {
  visitas: { total: number; shows: number; noShows: number; taxaShow: number }
  reservas: {
    total: number
    porUnidade: { francisco_rocha: number; nex_house: number }
    porTipo: { primeira_vez: number; quatro_horas: number; primeiro_uso_diaria: number; primeiro_uso_access_pass: number }
  }
  oportunidades: {
    totalGeral: number
    totalEP: number
    totalCloser: number
    funis: { nome: string; total: number }[]
  }
}

function isEPFunnel(name: string) {
  const n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return n.includes('escritorio privativo')
}

function isCloserDealStage(name: string) {
  const n = name.trim().toLowerCase()
  return (
    n === 'deals' || n === 'deal' || n === 'closer | deal' || n === 'closer | deals' ||
    (n.includes('closer') && n.includes('deal'))
  )
}

interface VisitaRow { compareceu: boolean }
interface ReservaRow { tipo: string; unidade: string }

function metricasVisitas(rows: VisitaRow[]): MetricasPeriodo['visitas'] {
  const total = rows.length
  const shows = rows.filter(r => r.compareceu).length
  const noShows = total - shows
  return { total, shows, noShows, taxaShow: total > 0 ? Math.round((shows / total) * 100) : 0 }
}

function metricasReservas(rows: ReservaRow[]): MetricasPeriodo['reservas'] {
  return {
    total: rows.length,
    porUnidade: {
      francisco_rocha: rows.filter(r => r.unidade === 'francisco_rocha').length,
      nex_house: rows.filter(r => r.unidade === 'nex_house').length,
    },
    porTipo: {
      primeira_vez: rows.filter(r => r.tipo === 'primeira_vez').length,
      quatro_horas: rows.filter(r => r.tipo === 'quatro_horas').length,
      primeiro_uso_diaria: rows.filter(r => r.tipo === 'primeiro_uso_diaria').length,
      primeiro_uso_access_pass: rows.filter(r => r.tipo === 'primeiro_uso_access_pass').length,
    },
  }
}

/**
 * Coleta todas as métricas necessárias para os 5 períodos do relatório de uma vez:
 * uma consulta por fonte de dado (cobrindo do início ao fim de todo o intervalo
 * relevante), com o corte por período feito em memória — evita repetir a mesma
 * consulta/chamada externa 5 vezes.
 */
export async function coletarMetricasDosPeriodos(
  periodos: ReturnType<typeof calcularPeriodos>
): Promise<Record<keyof ReturnType<typeof calcularPeriodos>, MetricasPeriodo>> {
  const todasAsDatas = Object.values(periodos).flatMap(p => [p.de, p.ate])
  const deGeral = todasAsDatas.reduce((a, b) => (a < b ? a : b))
  const ateGeral = todasAsDatas.reduce((a, b) => (a > b ? a : b))

  const supabase = createServerClient()

  const [visitasRes, reservasRes, oportunidadesPorFunil] = await Promise.all([
    supabase.from('registro_visitas').select('data, compareceu').gte('data', deGeral).lte('data', ateGeral),
    supabase.from('registro_reservas').select('data, tipo, unidade').gte('data', deGeral).lte('data', ateGeral),
    coletarDealsPorFunil(deGeral),
  ])

  const visitasRows = (visitasRes.data ?? []) as { data: string; compareceu: boolean }[]
  const reservasRows = (reservasRes.data ?? []) as { data: string; tipo: string; unidade: string }[]

  function paraPeriodo(p: Periodo): MetricasPeriodo {
    const visitas = metricasVisitas(visitasRows.filter(v => v.data >= p.de && v.data <= p.ate))
    const reservas = metricasReservas(reservasRows.filter(r => r.data >= p.de && r.data <= p.ate))

    const funis = oportunidadesPorFunil.map(f => ({
      nome: f.nome,
      isEP: f.isEP,
      total: f.deals.filter(d => {
        const dt = d.created_at?.slice(0, 10) ?? ''
        return dt >= p.de && dt <= p.ate
      }).length,
      totalCloser: f.isEP
        ? f.deals.filter(d => {
            const dt = d.created_at?.slice(0, 10) ?? ''
            return dt >= p.de && dt <= p.ate && f.closerStageIds.has(d.stage_id)
          }).length
        : 0,
    }))

    return {
      visitas,
      reservas,
      oportunidades: {
        totalGeral: funis.reduce((s, f) => s + f.total, 0),
        totalEP: funis.filter(f => f.isEP).reduce((s, f) => s + f.total, 0),
        totalCloser: funis.reduce((s, f) => s + f.totalCloser, 0),
        funis: funis.map(f => ({ nome: f.nome, total: f.total })),
      },
    }
  }

  const resultado = {} as Record<keyof ReturnType<typeof calcularPeriodos>, MetricasPeriodo>
  for (const [chave, periodo] of Object.entries(periodos)) {
    resultado[chave as keyof typeof periodos] = paraPeriodo(periodo)
  }
  return resultado
}

async function coletarDealsPorFunil(de: string) {
  const funnels = await listFunnelsMCP()
  return Promise.all(
    funnels.map(async funnel => {
      const [stages, deals] = await Promise.all([
        listStagesMCP(funnel.id) as Promise<RDStage[]>,
        listDealsMCP(funnel.id, de) as Promise<RDDeal[]>,
      ])
      const closerStageIds = new Set(stages.filter(s => isCloserDealStage(s.name)).map(s => s.id))
      return { nome: funnel.name, isEP: isEPFunnel(funnel.name), deals, closerStageIds }
    })
  )
}

// ── HTML do relatório ────────────────────────────────────────────────────────
// Identidade visual dos decks Nex House: monocromática (preto + ivory quente),
// sem paleta de acento colorida — hierarquia por brilho, não por matiz.

const COR = {
  void: '#000000',
  panel: '#0B0A08',
  panel2: '#131210',
  panel3: '#1B1917',
  ivory: '#FFFAF0',
  ivory88: 'rgba(255,250,240,.88)',
  ivory70: 'rgba(255,250,240,.70)',
  ivory52: 'rgba(255,250,240,.52)',
  ivory36: 'rgba(255,250,240,.36)',
  ivory20: 'rgba(255,250,240,.20)',
  line: 'rgba(255,250,240,.13)',
  line2: 'rgba(255,250,240,.24)',
  cold: 'rgba(255,255,255,.34)',
  coldLine: 'rgba(255,255,255,.20)',
}

const FONTE = `'Proxima Nova','Inter',Arial,sans-serif`

// Logo Nex House (wordmark oficial, fill branco — legível sobre o fundo escuro do relatório).
const LOGO_SVG = `<svg width="150" height="41" viewBox="0 0 944.53 255.72" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Nex House">
  <path fill="#FFFAF0" d="M322.5,141.92l18.4-106.22h-48.81l-11.45,91.04-11.45-91.04h-48.81l1.32,7.6c-10.51-8.21-24.74-11.4-41.5-11.4-30.18,0-52,9.94-59.31,39.84-4.17-28.89-19.67-39.84-41.68-39.84-12.76,0-24.03,6.45-30.41,24.66v-20.86H0v216.23h48.8V96.02c0-12.9,4.51-17.07,11.64-17.07s11.64,4.17,11.64,17.07v155.91h49.93v-31.97c8.25,26.74,29.42,35.76,58.19,35.76,14.66,0,27.4-2.45,37.39-8.56l-.96,4.77h48.81l15.2-93.32,15.21,93.32h48.8l-22.15-110.01ZM168.48,94.54c0-12.98,4.54-17.18,11.72-17.18s11.72,4.2,11.72,17.18v22.16h-23.44v-22.16ZM191.92,172.08v21.01c0,12.98-4.54,17.18-11.72,17.18s-11.72-4.2-11.72-17.18v-45.84h69.23l-5,24.83h-40.79Z"/>
  <path fill="#FFFAF0" d="M944.53,147.25v-50.41c0-49.66-24.57-64.94-61.23-64.94-27.93,0-48.7,8.51-57.44,33.47-8.67-24.96-29.15-33.47-55.95-33.47-23.69,0-42.33,6.38-52.55,23.06v-19.26h-48.81v156.29c0,12.9-4.5,17.07-11.64,17.07s-11.63-4.17-11.63-17.07V35.7h-49.94v27.5c-8.98-23.3-29.27-31.3-56.69-31.3-29.31,0-50.47,9.15-58.38,36.35-4.88-26.28-20.01-36.35-41.1-36.35-12.76,0-24.03,6.45-30.41,24.66V0h-48.81v251.93h48.81V96.02c0-12.9,4.51-17.07,11.64-17.07s11.64,4.17,11.64,17.07v155.91h49.93v-27.51c8.97,23.3,29.27,31.3,56.68,31.3,29.25,0,50.4-9.1,58.34-36.18,4.32,25.4,17.13,35.76,37.81,35.76,13.14,0,26.99-7.92,33.75-27.65v24.28h48.81v-22.54c9.89,19.47,28.87,26.33,52.93,26.33,26.93,0,47.34-8.86,56.28-31.57,9.11,23.5,29.52,31.57,56.73,31.57,36.66,0,61.23-15.27,61.23-64.93v-18.71h-49.52v21.01c0,12.98-4.53,17.18-11.71,17.18s-11.72-4.2-11.72-17.18v-45.84h72.95ZM871.58,94.54c0-12.98,4.54-17.18,11.72-17.18s11.71,4.2,11.71,17.18v22.16h-23.43v-22.16ZM550.03,192.38c0,12.61-4.4,16.68-11.38,16.68s-11.37-4.07-11.37-16.68v-99.02c0-12.61,4.4-16.69,11.37-16.69s11.38,4.08,11.38,16.69v99.02ZM770.29,210.27c-7.18,0-11.72-4.2-11.72-17.18v-21.39h-41.21v-46.32c6.64,10.56,16.24,17.73,25.72,24.55l20.41,14.89c13.98,9.93,18.52,13.37,18.52,28.27,0,12.98-4.54,17.18-11.72,17.18ZM821.31,159.03c-7.22-10.76-17.22-18.52-26.45-25.15l-16.25-11.84c-10.96-8.02-20.41-16.8-20.41-27.5,0-12.98,4.53-17.18,11.71-17.18s11.72,4.2,11.72,17.18v15.66h39.68v48.83Z"/>
</svg>`

function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function variacao(atual: number, anterior: number): { texto: string; tom: 'up' | 'down' | 'flat' } {
  if (anterior === 0 && atual === 0) return { texto: '·', tom: 'flat' }
  if (anterior === 0) return { texto: 'novo', tom: 'up' }
  const pct = Math.round(((atual - anterior) / anterior) * 100)
  if (pct === 0) return { texto: '0%', tom: 'flat' }
  return { texto: `${pct > 0 ? '+' : ''}${pct}%`, tom: pct > 0 ? 'up' : 'down' }
}

function badge(v: { texto: string; tom: 'up' | 'down' | 'flat' }): string {
  const estilo = v.tom === 'up'
    ? `color:#4ADE80;border:1px solid rgba(74,222,128,.35);background:rgba(74,222,128,.1);`
    : v.tom === 'down'
    ? `color:#F87171;border:1px solid rgba(248,113,113,.35);background:rgba(248,113,113,.1);`
    : `color:${COR.ivory36};border:1px solid ${COR.line};background:transparent;`
  return `<span style="display:inline-block;padding:2px 9px;border-radius:3px;font-size:11px;font-weight:700;letter-spacing:.03em;font-family:${FONTE};${estilo}">${v.texto}</span>`
}

function tile(label: string, valor: string | number): string {
  return `
    <div style="border:1px solid ${COR.line};background:${COR.panel};border-radius:3px;padding:14px 15px;min-width:130px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:${COR.ivory52};font-family:${FONTE};">${label}</p>
      <p style="margin:0;font-size:24px;font-weight:700;color:${COR.ivory};font-variant-numeric:tabular-nums;font-family:${FONTE};">${valor}</p>
    </div>`
}

// Paleta categórica para os gráficos — cores distintas sobre o fundo escuro do card.
const PALETA_GRAFICOS = ['#FFD400', '#5EEAD4', '#F97316', '#818CF8', '#F472B6', '#4ADE80']

/** Gráfico de rosca (donut) em SVG — sem dependências externas, funciona no anexo HTML. */
function donutChart(titulo: string, data: { label: string; value: number }[]): string {
  const total = data.reduce((s, d) => s + d.value, 0)
  const size = 130
  const thickness = 20
  const r = (size - thickness) / 2
  const c = size / 2
  const circunferencia = 2 * Math.PI * r

  let acumulado = 0
  const segmentos = total === 0 ? '' : data
    .filter(d => d.value > 0)
    .map((d, i) => {
      const fracao = d.value / total
      const comprimento = fracao * circunferencia
      const offset = -acumulado * circunferencia
      acumulado += fracao
      const cor = PALETA_GRAFICOS[i % PALETA_GRAFICOS.length]
      return `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${cor}" stroke-width="${thickness}" stroke-dasharray="${comprimento} ${circunferencia - comprimento}" stroke-dashoffset="${offset}" transform="rotate(-90 ${c} ${c})" />`
    })
    .join('')

  const svg = total === 0
    ? `<div style="width:${size}px;height:${size}px;border-radius:999px;border:${thickness}px solid ${COR.line};display:flex;align-items:center;justify-content:center;color:${COR.ivory36};font-size:11px;font-family:${FONTE};">sem dados</div>`
    : `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${segmentos}<circle cx="${c}" cy="${c}" r="${r - thickness / 2 - 3}" fill="${COR.panel}" /><text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central" font-size="20" font-weight="700" fill="${COR.ivory}" font-family="${FONTE}">${total}</text></svg>`

  const legenda = data.map((d, i) => {
    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
    const cor = PALETA_GRAFICOS[i % PALETA_GRAFICOS.length]
    return `
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:${COR.ivory70};margin-bottom:4px;font-family:${FONTE};">
        <span style="width:9px;height:9px;border-radius:2px;background:${cor};flex-shrink:0;"></span>
        <span style="flex:1;">${d.label}</span>
        <span style="font-weight:700;color:${COR.ivory};font-variant-numeric:tabular-nums;">${d.value}${total > 0 ? ` (${pct}%)` : ''}</span>
      </div>`
  }).join('')

  return `
    <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;min-width:220px;">
      <div style="flex-shrink:0;">${svg}</div>
      <div style="min-width:150px;flex:1;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:${COR.ivory};font-family:${FONTE};">${titulo}</p>
        ${legenda}
      </div>
    </div>`
}

/** Gráfico de barras horizontais — usado para listas de tamanho variável (ex.: funis do CRM). */
function barChart(titulo: string, data: { label: string; value: number }[]): string {
  const max = Math.max(1, ...data.map(d => d.value))
  const linhas = data.map((d, i) => {
    const pct = Math.round((d.value / max) * 100)
    const cor = PALETA_GRAFICOS[i % PALETA_GRAFICOS.length]
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:${COR.ivory70};margin-bottom:3px;font-family:${FONTE};">
          <span>${d.label}</span>
          <span style="font-weight:700;color:${COR.ivory};font-variant-numeric:tabular-nums;">${d.value}</span>
        </div>
        <div style="background:${COR.panel3};border-radius:3px;height:9px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${cor};border-radius:3px;"></div>
        </div>
      </div>`
  }).join('')

  return `
    <div>
      <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:${COR.ivory};font-family:${FONTE};">${titulo}</p>
      ${data.length === 0 ? `<p style="font-size:12px;color:${COR.ivory36};font-family:${FONTE};">Sem dados.</p>` : linhas}
    </div>`
}

function linhaComparativo(label: string, a: number, b: number, labelA: string, labelB: string): string {
  const v = variacao(a, b)
  return `
    <tr>
      <td style="padding:10px 14px;font-size:13px;color:${COR.ivory88};border-top:1px solid ${COR.line};font-family:${FONTE};">${label}</td>
      <td style="padding:10px 14px;font-size:13px;color:${COR.ivory};font-weight:700;text-align:center;border-top:1px solid ${COR.line};font-variant-numeric:tabular-nums;font-family:${FONTE};" title="${labelB}">${b}</td>
      <td style="padding:10px 14px;font-size:13px;color:${COR.ivory};font-weight:700;text-align:center;border-top:1px solid ${COR.line};font-variant-numeric:tabular-nums;font-family:${FONTE};" title="${labelA}">${a}</td>
      <td style="padding:10px 14px;text-align:center;border-top:1px solid ${COR.line};">${badge(v)}</td>
    </tr>`
}

function tabelaComparativo(titulo: string, labelA: string, labelB: string, linhas: string): string {
  return `
    <div style="margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${COR.ivory};font-family:${FONTE};">${titulo}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COR.line};border-radius:3px;overflow:hidden;border-collapse:separate;">
        <thead>
          <tr style="background:${COR.panel2};">
            <th style="padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:${COR.ivory52};text-align:left;font-family:${FONTE};">Métrica</th>
            <th style="padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:${COR.ivory52};text-align:center;font-family:${FONTE};">${labelB}</th>
            <th style="padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:${COR.ivory52};text-align:center;font-family:${FONTE};">${labelA}</th>
            <th style="padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:${COR.ivory52};text-align:center;font-family:${FONTE};">Variação</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`
}

function secaoCard(titulo: string, subtitulo: string, conteudoHtml: string): string {
  return `
    <div style="background:${COR.panel};border:1px solid ${COR.line};border-radius:3px;overflow:hidden;margin-bottom:20px;">
      <div style="padding:18px 24px;border-bottom:1px solid ${COR.line};">
        <p style="margin:0;font-size:16px;font-weight:700;color:${COR.ivory};font-family:${FONTE};">${titulo}</p>
        <p style="margin:3px 0 0;font-size:12px;color:${COR.ivory52};font-family:${FONTE};">${subtitulo}</p>
      </div>
      <div style="padding:20px 24px;">${conteudoHtml}</div>
    </div>`
}

export function gerarHtmlRelatorio(
  periodos: ReturnType<typeof calcularPeriodos>,
  metricas: Record<keyof ReturnType<typeof calcularPeriodos>, MetricasPeriodo>
): string {
  const { semanaPassada, semanaRetrasada, semanaCorrespondenteMesAnterior, mesAtual, mesAnterior } = periodos
  const m = metricas

  const kpisSemana = `
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
      ${tile('Visitas', m.semanaPassada.visitas.total)}
      ${tile('1º Uso (total)', m.semanaPassada.reservas.porTipo.primeiro_uso_diaria + m.semanaPassada.reservas.porTipo.primeiro_uso_access_pass)}
      ${tile('Uso 4h+', m.semanaPassada.reservas.porTipo.quatro_horas)}
      ${tile('Oportunidades CRM', m.semanaPassada.oportunidades.totalGeral)}
    </div>`

  const graficosSemana = `
    <div style="display:flex;flex-wrap:wrap;gap:24px;margin-bottom:20px;padding:16px 0;border-top:1px solid ${COR.line};border-bottom:1px solid ${COR.line};">
      ${donutChart('Reservas por Tipo', [
        { label: 'Reunião · 1ª vez', value: m.semanaPassada.reservas.porTipo.primeira_vez },
        { label: 'Reunião · 4h+', value: m.semanaPassada.reservas.porTipo.quatro_horas },
        { label: '1º Uso · Diária', value: m.semanaPassada.reservas.porTipo.primeiro_uso_diaria },
        { label: '1º Uso · Access Pass', value: m.semanaPassada.reservas.porTipo.primeiro_uso_access_pass },
      ])}
      ${donutChart('Reservas por Unidade', [
        { label: 'Francisco Rocha', value: m.semanaPassada.reservas.porUnidade.francisco_rocha },
        { label: 'Nex House', value: m.semanaPassada.reservas.porUnidade.nex_house },
      ])}
    </div>
    ${barChart('Oportunidades por Funil (RD CRM) · semana passada', m.semanaPassada.oportunidades.funis.map(f => ({ label: f.nome, value: f.total })))}`

  const detalheSemana = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COR.line};border-radius:3px;overflow:hidden;border-collapse:separate;">
      <tbody>
        <tr style="background:${COR.panel2};"><td style="padding:8px 14px;font-size:12px;color:${COR.ivory70};font-family:${FONTE};">Primeira Visita (Registro de Visita) · total</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;color:${COR.ivory};font-variant-numeric:tabular-nums;font-family:${FONTE};">${m.semanaPassada.visitas.total}</td></tr>
        <tr><td style="padding:8px 14px;font-size:12px;color:${COR.ivory70};border-top:1px solid ${COR.line};font-family:${FONTE};">Reunião · Primeira vez</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid ${COR.line};color:${COR.ivory};font-variant-numeric:tabular-nums;font-family:${FONTE};">${m.semanaPassada.reservas.porTipo.primeira_vez}</td></tr>
        <tr style="background:${COR.panel2};"><td style="padding:8px 14px;font-size:12px;color:${COR.ivory70};border-top:1px solid ${COR.line};font-family:${FONTE};">Reunião · 4h ou mais</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid ${COR.line};color:${COR.ivory};font-variant-numeric:tabular-nums;font-family:${FONTE};">${m.semanaPassada.reservas.porTipo.quatro_horas}</td></tr>
        <tr><td style="padding:8px 14px;font-size:12px;color:${COR.ivory70};border-top:1px solid ${COR.line};font-family:${FONTE};">1º Uso · Diária</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid ${COR.line};color:${COR.ivory};font-variant-numeric:tabular-nums;font-family:${FONTE};">${m.semanaPassada.reservas.porTipo.primeiro_uso_diaria}</td></tr>
        <tr style="background:${COR.panel2};"><td style="padding:8px 14px;font-size:12px;color:${COR.ivory70};border-top:1px solid ${COR.line};font-family:${FONTE};">1º Uso · Access Pass</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid ${COR.line};color:${COR.ivory};font-variant-numeric:tabular-nums;font-family:${FONTE};">${m.semanaPassada.reservas.porTipo.primeiro_uso_access_pass}</td></tr>
        <tr><td style="padding:8px 14px;font-size:12px;color:${COR.ivory70};border-top:1px solid ${COR.line};font-family:${FONTE};">Reservas · Francisco Rocha</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid ${COR.line};color:${COR.ivory};font-variant-numeric:tabular-nums;font-family:${FONTE};">${m.semanaPassada.reservas.porUnidade.francisco_rocha}</td></tr>
        <tr style="background:${COR.panel2};"><td style="padding:8px 14px;font-size:12px;color:${COR.ivory70};border-top:1px solid ${COR.line};font-family:${FONTE};">Reservas · Nex House</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid ${COR.line};color:${COR.ivory};font-variant-numeric:tabular-nums;font-family:${FONTE};">${m.semanaPassada.reservas.porUnidade.nex_house}</td></tr>
      </tbody>
    </table>`

  const comparativoSemanas = tabelaComparativo(
    `Semana retrasada (${formatarDataBR(semanaRetrasada.de)}–${formatarDataBR(semanaRetrasada.ate)}) → Semana passada (${formatarDataBR(semanaPassada.de)}–${formatarDataBR(semanaPassada.ate)})`,
    'Semana passada', 'Semana retrasada',
    [
      linhaComparativo('Visitas (total)', m.semanaPassada.visitas.total, m.semanaRetrasada.visitas.total, semanaPassada.label, semanaRetrasada.label),
      linhaComparativo('1º Uso (Diária + Access Pass)', m.semanaPassada.reservas.porTipo.primeiro_uso_diaria + m.semanaPassada.reservas.porTipo.primeiro_uso_access_pass, m.semanaRetrasada.reservas.porTipo.primeiro_uso_diaria + m.semanaRetrasada.reservas.porTipo.primeiro_uso_access_pass, semanaPassada.label, semanaRetrasada.label),
      linhaComparativo('Uso 4h ou mais', m.semanaPassada.reservas.porTipo.quatro_horas, m.semanaRetrasada.reservas.porTipo.quatro_horas, semanaPassada.label, semanaRetrasada.label),
      linhaComparativo('Oportunidades CRM (total)', m.semanaPassada.oportunidades.totalGeral, m.semanaRetrasada.oportunidades.totalGeral, semanaPassada.label, semanaRetrasada.label),
    ].join('')
  )

  const comparativoMesAnteriorSemana = tabelaComparativo(
    `Semana correspondente do mês anterior (${formatarDataBR(semanaCorrespondenteMesAnterior.de)}–${formatarDataBR(semanaCorrespondenteMesAnterior.ate)}) → Semana passada`,
    'Semana passada', 'Mesma semana, mês anterior',
    [
      linhaComparativo('Visitas (total)', m.semanaPassada.visitas.total, m.semanaCorrespondenteMesAnterior.visitas.total, semanaPassada.label, semanaCorrespondenteMesAnterior.label),
      linhaComparativo('1º Uso (Diária + Access Pass)', m.semanaPassada.reservas.porTipo.primeiro_uso_diaria + m.semanaPassada.reservas.porTipo.primeiro_uso_access_pass, m.semanaCorrespondenteMesAnterior.reservas.porTipo.primeiro_uso_diaria + m.semanaCorrespondenteMesAnterior.reservas.porTipo.primeiro_uso_access_pass, semanaPassada.label, semanaCorrespondenteMesAnterior.label),
      linhaComparativo('Uso 4h ou mais', m.semanaPassada.reservas.porTipo.quatro_horas, m.semanaCorrespondenteMesAnterior.reservas.porTipo.quatro_horas, semanaPassada.label, semanaCorrespondenteMesAnterior.label),
      linhaComparativo('Oportunidades CRM (total)', m.semanaPassada.oportunidades.totalGeral, m.semanaCorrespondenteMesAnterior.oportunidades.totalGeral, semanaPassada.label, semanaCorrespondenteMesAnterior.label),
    ].join('')
  )

  const kpisMes = `
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
      ${tile('Visitas no mês', m.mesAtual.visitas.total)}
      ${tile('1º Uso no mês', m.mesAtual.reservas.porTipo.primeiro_uso_diaria + m.mesAtual.reservas.porTipo.primeiro_uso_access_pass)}
      ${tile('Uso 4h+ no mês', m.mesAtual.reservas.porTipo.quatro_horas)}
      ${tile('Oportunidades CRM no mês', m.mesAtual.oportunidades.totalGeral)}
    </div>`

  const comparativoMeses = tabelaComparativo(
    `Mês anterior (${formatarDataBR(mesAnterior.de)}–${formatarDataBR(mesAnterior.ate)}) → Mês atual (${formatarDataBR(mesAtual.de)}–${formatarDataBR(mesAtual.ate)}), mesmo intervalo de dias`,
    'Mês atual', 'Mês anterior',
    [
      linhaComparativo('Visitas (total)', m.mesAtual.visitas.total, m.mesAnterior.visitas.total, mesAtual.label, mesAnterior.label),
      linhaComparativo('1º Uso (Diária + Access Pass)', m.mesAtual.reservas.porTipo.primeiro_uso_diaria + m.mesAtual.reservas.porTipo.primeiro_uso_access_pass, m.mesAnterior.reservas.porTipo.primeiro_uso_diaria + m.mesAnterior.reservas.porTipo.primeiro_uso_access_pass, mesAtual.label, mesAnterior.label),
      linhaComparativo('Uso 4h ou mais', m.mesAtual.reservas.porTipo.quatro_horas, m.mesAnterior.reservas.porTipo.quatro_horas, mesAtual.label, mesAnterior.label),
      linhaComparativo('Oportunidades CRM (total)', m.mesAtual.oportunidades.totalGeral, m.mesAnterior.oportunidades.totalGeral, mesAtual.label, mesAnterior.label),
    ].join('')
  )

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard de Marketing &amp; Vendas · Nex House</title>
</head>
<body style="margin:0;padding:0;background:${COR.void};font-family:${FONTE};color:${COR.ivory88};">
  <div style="max-width:760px;margin:0 auto;padding:40px 20px 32px;">

    <div style="margin-bottom:28px;">
      ${LOGO_SVG}
      <p style="margin:16px 0 0;font-size:26px;font-weight:500;letter-spacing:-0.01em;color:${COR.ivory};">Dashboard de Marketing &amp; Vendas</p>
      <p style="margin:8px 0 0;font-size:14px;color:${COR.ivory70};">Semana de ${formatarDataBR(semanaPassada.de)} a ${formatarDataBR(semanaPassada.ate)}</p>
    </div>

    ${secaoCard('Resumo da Semana Passada', `${formatarDataBR(semanaPassada.de)} · ${formatarDataBR(semanaPassada.ate)}`, kpisSemana + graficosSemana + detalheSemana)}

    ${secaoCard('Comparativos Semanais', 'Semana a semana e contra o mesmo período do mês anterior', comparativoSemanas + comparativoMesAnteriorSemana)}

    ${secaoCard('Totais do Mês', `Acumulado de ${formatarDataBR(mesAtual.de)} até ${formatarDataBR(mesAtual.ate)}`, kpisMes + comparativoMeses)}

    <p style="margin:12px 4px 0;font-size:11px;line-height:1.55;color:${COR.ivory36};">
      Gerado automaticamente toda segunda-feira às 10h30 pelo Nex Marketing Operações.
      Não inclui a métrica de contratos gerados. "Semana correspondente do mês anterior" = mesma semana, 4 semanas (28 dias) antes.
    </p>

  </div>
</body>
</html>`
}
