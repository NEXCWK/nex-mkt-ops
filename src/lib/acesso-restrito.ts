/**
 * Restrição de acesso pontual: apenas este e-mail pode ver o Dashboard/análise
 * (notas, gráficos, KPIs) do Avaliador de Atendimentos e do Avaliador de
 * Telefonemas. O envio de transcrições para avaliação continua liberado para
 * todos os usuários — a restrição é só sobre visualizar os resultados agregados.
 */
export const EMAIL_DASHBOARD_AVALIACAO_PERMITIDO = 'felipe@nexcoworking.com.br'

export function podeAcessarDashboardAvaliacao(email?: string | null): boolean {
  return (email ?? '').toLowerCase() === EMAIL_DASHBOARD_AVALIACAO_PERMITIDO
}
