import { NextRequest, NextResponse } from 'next/server'
import { getAccessTokenForUser } from '@/lib/google-token'
import { sendEmailComAnexoViaGmail } from '@/lib/gmail'
import { calcularPeriodoMensal, coletarMetricasDosPeriodos, gerarHtmlRelatorioMensal } from '@/lib/relatorio-semanal'
import { DESTINATARIO_RELATORIO, CC_RELATORIO } from '@/lib/relatorio-destinatarios'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CONTA_LOGIN = DESTINATARIO_RELATORIO

/**
 * Execução automática (chamada pelo GitHub Actions cron, todo dia 1º do mês
 * às 10h30 BRT). Gera o relatório mensal do Dashboard — mês anterior completo
 * comparado ao mês anterior a esse — e envia por e-mail (em anexo, como HTML)
 * para a lista de destinatários de src/lib/relatorio-destinatarios.ts.
 *
 * Autenticação: header `x-cron-secret` OU `?secret=` deve bater com CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secretEsperado = process.env.CRON_SECRET
  const secretRecebido =
    req.headers.get('x-cron-secret') ??
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (!secretEsperado || secretRecebido !== secretEsperado) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const credenciais = await getAccessTokenForUser(CONTA_LOGIN)
  if (!credenciais) {
    return NextResponse.json(
      { error: `Sem refresh_token salvo para ${CONTA_LOGIN}. É necessário fazer login uma vez no sistema.` },
      { status: 500 }
    )
  }

  const hojeIso = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

  try {
    const periodos = calcularPeriodoMensal(hojeIso)
    const metricas = await coletarMetricasDosPeriodos(periodos)
    const html = gerarHtmlRelatorioMensal(periodos, metricas)

    const [ano, mes] = periodos.mesAtual.de.split('-')
    const nomeMes = new Date(`${periodos.mesAtual.de}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long' })

    const { messageId } = await sendEmailComAnexoViaGmail({
      accessToken: credenciais.accessToken,
      refreshToken: credenciais.refreshToken,
      to: DESTINATARIO_RELATORIO,
      cc: CC_RELATORIO,
      subject: `Relatório Mensal - Métricas de Marketing (${nomeMes}/${ano})`,
      body: '<p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#333;">Segue em anexo o relatório mensal de métricas de marketing e vendas.</p>',
      anexo: {
        filename: `relatorio-mensal-${ano}-${mes}.html`,
        mimeType: 'text/html',
        contentBase64: Buffer.from(html, 'utf-8').toString('base64'),
      },
      senderName: `Nex Marketing Operações <${DESTINATARIO_RELATORIO}>`,
    })

    return NextResponse.json({ status: 'ok', messageId, periodo: periodos.mesAtual })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    return NextResponse.json({ status: 'erro', error: msg }, { status: 500 })
  }
}
