/**
 * Notificações no Slack via Incoming Webhook — canal exclusivo para novos
 * registros de visitas e reservas. Não bloqueia o fluxo principal se falhar
 * (mesmo padrão do convite de Google Agenda): SLACK_WEBHOOK_URL ausente ou
 * uma falha de rede/API não impedem o registro nem o e-mail de sair.
 */

export interface CampoSlack {
  label: string
  valor: string | null | undefined
}

export function formatarMensagemSlack(titulo: string, campos: CampoSlack[]): string {
  const linhas = campos
    .filter((c): c is { label: string; valor: string } => Boolean(c.valor))
    .map(c => `• *${c.label}:* ${c.valor}`)
    .join('\n')
  return `${titulo}\n\n${linhas}`
}

export async function enviarNotificacaoSlack(texto: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: texto }),
  })
  if (!res.ok) {
    throw new Error(`Falha ao notificar Slack: HTTP ${res.status}`)
  }
}
