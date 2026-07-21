/**
 * Restrição de acesso pontual: apenas este e-mail pode ver notas, dashboards e
 * análises do Avaliador de Atendimentos e do Avaliador de Telefonemas.
 */
export const EMAIL_AVALIACAO_PERMITIDO = 'felipe@nex.work'

export function podeAcessarAvaliacao(email?: string | null): boolean {
  return (email ?? '').toLowerCase() === EMAIL_AVALIACAO_PERMITIDO
}
