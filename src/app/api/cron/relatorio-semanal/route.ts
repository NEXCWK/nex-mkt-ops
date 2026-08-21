import { NextRequest, NextResponse } from 'next/server'
import { getAccessTokenForUser } from '@/lib/google-token'
import { sendEmailComAnexoViaGmail } from '@/lib/gmail'
import { calcularPeriodos, coletarMetricasDosPeriodos, gerarHtmlRelatorio } from '@/lib/relatorio-semanal'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Conta usada para autenticação/login no sistema (exige domínio @nexcoworking.com.br —
// ver src/lib/auth.ts). É essa conta que tem o refresh_token salvo.
const CONTA_LOGIN = 'felipe@nexcoworking.com.br'
// Endereço de envio/recebimento do relatório — alias configurado no Gmail da conta acima
// (mesmo padrão usado em Registro de Visitas/Reservas, ver src/lib/remetentes.ts).
const DESTINATARIO = 'felipe@nex.work'

/**
 * Execução automática (chamada pelo GitHub Actions cron, toda segunda-feira às
 * 10h30 BRT). Gera o relatório semanal do Dashboard e envia por e-mail (em
 * anexo, como HTML) para felipe@nex.work, a partir do próprio felipe@nex.work.
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
    const periodos = calcularPeriodos(hojeIso)
    const metricas = await coletarMetricasDosPeriodos(periodos)
    const html = gerarHtmlRelatorio(periodos, metricas)

    const [d, m, y] = [
      periodos.semanaPassada.de.slice(8, 10),
      periodos.semanaPassada.de.slice(5, 7),
      periodos.semanaPassada.de.slice(0, 4),
    ]

    const { messageId } = await sendEmailComAnexoViaGmail({
      accessToken: credenciais.accessToken,
      refreshToken: credenciais.refreshToken,
      to: DESTINATARIO,
      cc: [],
      subject: `Relatório Semanal Nex — semana de ${d}/${m}/${y}`,
      body: '<p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#333;">Segue em anexo o relatório semanal do Dashboard. Bom início de semana!</p>',
      anexo: {
        filename: `relatorio-semanal-${periodos.semanaPassada.de}.html`,
        mimeType: 'text/html',
        contentBase64: Buffer.from(html, 'utf-8').toString('base64'),
      },
      senderName: `Nex Marketing Operações <${DESTINATARIO}>`,
    })

    return NextResponse.json({ status: 'ok', messageId, periodo: periodos.semanaPassada })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    return NextResponse.json({ status: 'erro', error: msg }, { status: 500 })
  }
}
