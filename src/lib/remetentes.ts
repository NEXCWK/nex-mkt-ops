/**
 * Remetentes disponíveis para disparo de e-mail em massa (Sistema BDR, Sistema
 * Parcerias e Sistema CCO) — o operador escolhe qual endereço aparece como "De"
 * na mensagem, independente de qual conta Google está logada fazendo o envio.
 */
export interface RemetenteDisparo {
  email: string
  nome: string
}

export const REMETENTES_DISPARO: RemetenteDisparo[] = [
  { email: 'comercial@nex.work', nome: 'Comercial' },
  { email: 'felipe@nex.work', nome: 'Felipe' },
  { email: 'bruna@nex.work', nome: 'Bruna' },
  { email: 'comercial@nexcoworking.com.br', nome: 'Comercial' },
  { email: 'felipe@nexcoworking.com.br', nome: 'Felipe' },
  { email: 'bruna@nexcoworking.com.br', nome: 'Bruna' },
]

const MAPA_REMETENTES = new Map(REMETENTES_DISPARO.map(r => [r.email, r]))

export function remetenteValido(email: string): boolean {
  return MAPA_REMETENTES.has(email)
}

/** Monta o cabeçalho "De" (ex.: "Comercial · Nex Coworking <comercial@nex.work>"). */
export function senderNameParaRemetente(email: string): string {
  const r = MAPA_REMETENTES.get(email)
  return r ? `${r.nome} · Nex Coworking <${r.email}>` : `Nex Coworking <${email}>`
}
