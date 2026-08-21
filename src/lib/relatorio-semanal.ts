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

function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function variacao(atual: number, anterior: number): { texto: string; tom: 'up' | 'down' | 'flat' } {
  if (anterior === 0 && atual === 0) return { texto: '—', tom: 'flat' }
  if (anterior === 0) return { texto: 'novo', tom: 'up' }
  const pct = Math.round(((atual - anterior) / anterior) * 100)
  if (pct === 0) return { texto: '0%', tom: 'flat' }
  return { texto: `${pct > 0 ? '+' : ''}${pct}%`, tom: pct > 0 ? 'up' : 'down' }
}

function badge(v: { texto: string; tom: 'up' | 'down' | 'flat' }): string {
  const cor = v.tom === 'up' ? '#059669' : v.tom === 'down' ? '#dc2626' : '#888'
  const bg = v.tom === 'up' ? '#ecfdf5' : v.tom === 'down' ? '#fef2f2' : '#f5f5f5'
  return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:700;color:${cor};background:${bg};">${v.texto}</span>`
}

function tile(label: string, valor: string | number): string {
  return `
    <div style="background:#fafafa;border:1px solid #eee;border-radius:10px;padding:14px 16px;min-width:130px;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#999;">${label}</p>
      <p style="margin:0;font-size:22px;font-weight:700;color:#0a0a0a;">${valor}</p>
    </div>`
}

function linhaComparativo(label: string, a: number, b: number, labelA: string, labelB: string): string {
  const v = variacao(a, b)
  return `
    <tr>
      <td style="padding:10px 14px;font-size:13px;color:#333;border-top:1px solid #f0f0f0;">${label}</td>
      <td style="padding:10px 14px;font-size:13px;color:#0a0a0a;font-weight:600;text-align:center;border-top:1px solid #f0f0f0;" title="${labelB}">${b}</td>
      <td style="padding:10px 14px;font-size:13px;color:#0a0a0a;font-weight:600;text-align:center;border-top:1px solid #f0f0f0;" title="${labelA}">${a}</td>
      <td style="padding:10px 14px;text-align:center;border-top:1px solid #f0f0f0;">${badge(v)}</td>
    </tr>`
}

function tabelaComparativo(titulo: string, labelA: string, labelB: string, linhas: string): string {
  return `
    <div style="margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0a0a0a;">${titulo}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:10px;overflow:hidden;border-collapse:separate;">
        <thead>
          <tr style="background:#fafafa;">
            <th style="padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#999;text-align:left;">Métrica</th>
            <th style="padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#999;text-align:center;">${labelB}</th>
            <th style="padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#999;text-align:center;">${labelA}</th>
            <th style="padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#999;text-align:center;">Variação</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`
}

function secaoCard(titulo: string, subtitulo: string, conteudoHtml: string): string {
  return `
    <div style="background:#fff;border:1px solid #e5e5e5;border-radius:14px;overflow:hidden;margin-bottom:20px;">
      <div style="padding:16px 24px;border-bottom:1px solid #f0f0f0;">
        <p style="margin:0;font-size:15px;font-weight:700;color:#0a0a0a;">${titulo}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#999;">${subtitulo}</p>
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
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
      ${tile('Visitas', m.semanaPassada.visitas.total)}
      ${tile('Taxa de Show', `${m.semanaPassada.visitas.taxaShow}%`)}
      ${tile('1º Uso (total)', m.semanaPassada.reservas.porTipo.primeiro_uso_diaria + m.semanaPassada.reservas.porTipo.primeiro_uso_access_pass)}
      ${tile('Uso 4h+', m.semanaPassada.reservas.porTipo.quatro_horas)}
      ${tile('Oportunidades CRM', m.semanaPassada.oportunidades.totalGeral)}
      ${tile('Closer | Deal (EP)', m.semanaPassada.oportunidades.totalCloser)}
    </div>`

  const detalheSemana = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:10px;overflow:hidden;border-collapse:separate;">
      <tbody>
        <tr style="background:#fafafa;"><td style="padding:8px 14px;font-size:12px;color:#666;">Primeira Visita (Registro de Visita) — total</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;">${m.semanaPassada.visitas.total}</td></tr>
        <tr><td style="padding:8px 14px;font-size:12px;color:#666;border-top:1px solid #f0f0f0;">— Compareceram (shows)</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid #f0f0f0;">${m.semanaPassada.visitas.shows}</td></tr>
        <tr style="background:#fafafa;"><td style="padding:8px 14px;font-size:12px;color:#666;border-top:1px solid #f0f0f0;">— No-shows</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid #f0f0f0;">${m.semanaPassada.visitas.noShows}</td></tr>
        <tr><td style="padding:8px 14px;font-size:12px;color:#666;border-top:1px solid #f0f0f0;">Reunião — Primeira vez</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid #f0f0f0;">${m.semanaPassada.reservas.porTipo.primeira_vez}</td></tr>
        <tr style="background:#fafafa;"><td style="padding:8px 14px;font-size:12px;color:#666;border-top:1px solid #f0f0f0;">Reunião — 4h ou mais</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid #f0f0f0;">${m.semanaPassada.reservas.porTipo.quatro_horas}</td></tr>
        <tr><td style="padding:8px 14px;font-size:12px;color:#666;border-top:1px solid #f0f0f0;">1º Uso — Diária</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid #f0f0f0;">${m.semanaPassada.reservas.porTipo.primeiro_uso_diaria}</td></tr>
        <tr style="background:#fafafa;"><td style="padding:8px 14px;font-size:12px;color:#666;border-top:1px solid #f0f0f0;">1º Uso — Access Pass</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid #f0f0f0;">${m.semanaPassada.reservas.porTipo.primeiro_uso_access_pass}</td></tr>
        <tr><td style="padding:8px 14px;font-size:12px;color:#666;border-top:1px solid #f0f0f0;">Reservas — Francisco Rocha</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid #f0f0f0;">${m.semanaPassada.reservas.porUnidade.francisco_rocha}</td></tr>
        <tr style="background:#fafafa;"><td style="padding:8px 14px;font-size:12px;color:#666;border-top:1px solid #f0f0f0;">Reservas — Nex House</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid #f0f0f0;">${m.semanaPassada.reservas.porUnidade.nex_house}</td></tr>
      </tbody>
    </table>`

  const funisHtml = m.semanaPassada.oportunidades.funis.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:10px;overflow:hidden;border-collapse:separate;margin-top:14px;">
        <thead><tr style="background:#fafafa;"><th style="padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#999;text-align:left;">Funil (RD CRM)</th><th style="padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#999;text-align:right;">Oportunidades — semana passada</th></tr></thead>
        <tbody>${m.semanaPassada.oportunidades.funis.map((f, i) => `<tr style="${i % 2 ? 'background:#fafafa;' : ''}"><td style="padding:8px 14px;font-size:12px;color:#333;border-top:1px solid #f0f0f0;">${f.nome}</td><td style="padding:8px 14px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid #f0f0f0;">${f.total}</td></tr>`).join('')}</tbody>
      </table>`
    : '<p style="font-size:12px;color:#999;">Nenhum funil retornado pelo RD CRM neste período.</p>'

  const comparativoSemanas = tabelaComparativo(
    `Semana retrasada (${formatarDataBR(semanaRetrasada.de)}–${formatarDataBR(semanaRetrasada.ate)}) → Semana passada (${formatarDataBR(semanaPassada.de)}–${formatarDataBR(semanaPassada.ate)})`,
    'Semana passada', 'Semana retrasada',
    [
      linhaComparativo('Visitas (total)', m.semanaPassada.visitas.total, m.semanaRetrasada.visitas.total, semanaPassada.label, semanaRetrasada.label),
      linhaComparativo('Taxa de Show', m.semanaPassada.visitas.taxaShow, m.semanaRetrasada.visitas.taxaShow, semanaPassada.label, semanaRetrasada.label),
      linhaComparativo('1º Uso (Diária + Access Pass)', m.semanaPassada.reservas.porTipo.primeiro_uso_diaria + m.semanaPassada.reservas.porTipo.primeiro_uso_access_pass, m.semanaRetrasada.reservas.porTipo.primeiro_uso_diaria + m.semanaRetrasada.reservas.porTipo.primeiro_uso_access_pass, semanaPassada.label, semanaRetrasada.label),
      linhaComparativo('Uso 4h ou mais', m.semanaPassada.reservas.porTipo.quatro_horas, m.semanaRetrasada.reservas.porTipo.quatro_horas, semanaPassada.label, semanaRetrasada.label),
      linhaComparativo('Oportunidades CRM (total)', m.semanaPassada.oportunidades.totalGeral, m.semanaRetrasada.oportunidades.totalGeral, semanaPassada.label, semanaRetrasada.label),
      linhaComparativo('Closer | Deal (EP)', m.semanaPassada.oportunidades.totalCloser, m.semanaRetrasada.oportunidades.totalCloser, semanaPassada.label, semanaRetrasada.label),
    ].join('')
  )

  const comparativoMesAnteriorSemana = tabelaComparativo(
    `Semana correspondente do mês anterior (${formatarDataBR(semanaCorrespondenteMesAnterior.de)}–${formatarDataBR(semanaCorrespondenteMesAnterior.ate)}) → Semana passada`,
    'Semana passada', 'Mesma semana, mês anterior',
    [
      linhaComparativo('Visitas (total)', m.semanaPassada.visitas.total, m.semanaCorrespondenteMesAnterior.visitas.total, semanaPassada.label, semanaCorrespondenteMesAnterior.label),
      linhaComparativo('Taxa de Show', m.semanaPassada.visitas.taxaShow, m.semanaCorrespondenteMesAnterior.visitas.taxaShow, semanaPassada.label, semanaCorrespondenteMesAnterior.label),
      linhaComparativo('1º Uso (Diária + Access Pass)', m.semanaPassada.reservas.porTipo.primeiro_uso_diaria + m.semanaPassada.reservas.porTipo.primeiro_uso_access_pass, m.semanaCorrespondenteMesAnterior.reservas.porTipo.primeiro_uso_diaria + m.semanaCorrespondenteMesAnterior.reservas.porTipo.primeiro_uso_access_pass, semanaPassada.label, semanaCorrespondenteMesAnterior.label),
      linhaComparativo('Uso 4h ou mais', m.semanaPassada.reservas.porTipo.quatro_horas, m.semanaCorrespondenteMesAnterior.reservas.porTipo.quatro_horas, semanaPassada.label, semanaCorrespondenteMesAnterior.label),
      linhaComparativo('Oportunidades CRM (total)', m.semanaPassada.oportunidades.totalGeral, m.semanaCorrespondenteMesAnterior.oportunidades.totalGeral, semanaPassada.label, semanaCorrespondenteMesAnterior.label),
      linhaComparativo('Closer | Deal (EP)', m.semanaPassada.oportunidades.totalCloser, m.semanaCorrespondenteMesAnterior.oportunidades.totalCloser, semanaPassada.label, semanaCorrespondenteMesAnterior.label),
    ].join('')
  )

  const kpisMes = `
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
      ${tile('Visitas no mês', m.mesAtual.visitas.total)}
      ${tile('1º Uso no mês', m.mesAtual.reservas.porTipo.primeiro_uso_diaria + m.mesAtual.reservas.porTipo.primeiro_uso_access_pass)}
      ${tile('Uso 4h+ no mês', m.mesAtual.reservas.porTipo.quatro_horas)}
      ${tile('Oportunidades CRM no mês', m.mesAtual.oportunidades.totalGeral)}
      ${tile('Closer | Deal (EP) no mês', m.mesAtual.oportunidades.totalCloser)}
    </div>`

  const comparativoMeses = tabelaComparativo(
    `Mês anterior (${formatarDataBR(mesAnterior.de)}–${formatarDataBR(mesAnterior.ate)}) → Mês atual (${formatarDataBR(mesAtual.de)}–${formatarDataBR(mesAtual.ate)}), mesmo intervalo de dias`,
    'Mês atual', 'Mês anterior',
    [
      linhaComparativo('Visitas (total)', m.mesAtual.visitas.total, m.mesAnterior.visitas.total, mesAtual.label, mesAnterior.label),
      linhaComparativo('Taxa de Show', m.mesAtual.visitas.taxaShow, m.mesAnterior.visitas.taxaShow, mesAtual.label, mesAnterior.label),
      linhaComparativo('1º Uso (Diária + Access Pass)', m.mesAtual.reservas.porTipo.primeiro_uso_diaria + m.mesAtual.reservas.porTipo.primeiro_uso_access_pass, m.mesAnterior.reservas.porTipo.primeiro_uso_diaria + m.mesAnterior.reservas.porTipo.primeiro_uso_access_pass, mesAtual.label, mesAnterior.label),
      linhaComparativo('Uso 4h ou mais', m.mesAtual.reservas.porTipo.quatro_horas, m.mesAnterior.reservas.porTipo.quatro_horas, mesAtual.label, mesAnterior.label),
      linhaComparativo('Oportunidades CRM (total)', m.mesAtual.oportunidades.totalGeral, m.mesAnterior.oportunidades.totalGeral, mesAtual.label, mesAnterior.label),
      linhaComparativo('Closer | Deal (EP)', m.mesAtual.oportunidades.totalCloser, m.mesAnterior.oportunidades.totalCloser, mesAtual.label, mesAnterior.label),
    ].join('')
  )

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Relatório Semanal — Nex</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;color:#0a0a0a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="720" cellpadding="0" cellspacing="0" style="max-width:100%;">
        <tr>
          <td style="background:#0a0a0a;padding:28px 32px;border-radius:14px 14px 0 0;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">Nex.</span>
            <span style="color:#888;font-size:13px;margin-left:12px;">Relatório Semanal</span>
            <p style="margin:10px 0 0;color:#ccc;font-size:13px;">Semana de ${formatarDataBR(semanaPassada.de)} a ${formatarDataBR(semanaPassada.ate)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 0 0;">

            ${secaoCard('Resumo da Semana Passada', `${formatarDataBR(semanaPassada.de)} – ${formatarDataBR(semanaPassada.ate)}`, kpisSemana + detalheSemana + funisHtml)}

            ${secaoCard('Comparativos Semanais', 'Semana a semana e contra o mesmo período do mês anterior', comparativoSemanas + comparativoMesAnteriorSemana)}

            ${secaoCard('Totais do Mês', `Acumulado de ${formatarDataBR(mesAtual.de)} até ${formatarDataBR(mesAtual.ate)}`, kpisMes + comparativoMeses)}

          </td>
        </tr>
        <tr>
          <td style="padding:8px 8px 24px;">
            <p style="margin:0;font-size:11px;color:#aaa;">
              Gerado automaticamente toda segunda-feira às 10h30 pelo Nex Marketing Operações.
              Não inclui a métrica de contratos gerados. "Semana correspondente do mês anterior" = mesma semana, 4 semanas (28 dias) antes.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
