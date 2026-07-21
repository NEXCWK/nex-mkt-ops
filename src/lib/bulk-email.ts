import { sendEmailViaGmail } from '@/lib/gmail'

/** Remetente comercial padrão para disparos de prospecção/CCO. */
export const COMERCIAL_FROM = process.env.COMERCIAL_FROM_EMAIL || 'comercial@nexcoworking.com.br'
export const COMERCIAL_NAME = process.env.COMERCIAL_FROM_NAME || 'Nex Coworking'

export interface Destinatario {
  email: string
  /** E-mail secundário/institucional da empresa — recebe cópia junto com o principal. */
  emailSecundario?: string
  nome?: string
  empresa?: string
  [k: string]: string | undefined
}

/** Substitui {{nome}}, {{empresa}} e quaisquer outras chaves do destinatário. */
export function mergeVariaveis(texto: string, d: Destinatario): string {
  return texto.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_m, chave: string) => {
    const v = d[chave.toLowerCase()] ?? d[chave]
    return (v ?? '').toString()
  })
}

/** Converte texto simples (com quebras de linha) em HTML básico. */
export function textoParaHtml(texto: string): string {
  const esc = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#1A1A1A;">${esc.replace(/\n/g, '<br>')}</div>`
}

export interface EnviarLoteParams {
  accessToken: string
  refreshToken?: string
  destinatarios: Destinatario[]
  assunto: string
  corpo: string
  senderName?: string
}

export async function enviarLote({
  accessToken,
  refreshToken,
  destinatarios,
  assunto,
  corpo,
  senderName,
}: EnviarLoteParams): Promise<{ enviados: number; falhas: number; erros: string[] }> {
  let enviados = 0
  let falhas = 0
  const erros: string[] = []
  const from = senderName || `${COMERCIAL_NAME} <${COMERCIAL_FROM}>`

  for (const d of destinatarios) {
    // Envia sempre para o e-mail principal e, quando preenchido e válido, também para o secundário
    // — cada endereço recebe seu PRÓPRIO e-mail individual (não um único e-mail com dois destinatários).
    const destinos = [d.email, d.emailSecundario]
      .filter((e): e is string => !!e && e.includes('@'))
      .filter((e, i, arr) => arr.indexOf(e) === i)

    if (destinos.length === 0) {
      falhas++
      erros.push(`E-mail inválido: ${d.email || '(vazio)'}`)
      continue
    }

    for (const destino of destinos) {
      try {
        await sendEmailViaGmail({
          accessToken,
          refreshToken,
          to: destino,
          cc: [],
          subject: mergeVariaveis(assunto, d),
          body: textoParaHtml(mergeVariaveis(corpo, d)),
          senderName: from,
        })
        enviados++
      } catch (e) {
        falhas++
        erros.push(`${destino}: ${e instanceof Error ? e.message : 'erro'}`)
      }
    }
  }

  return { enviados, falhas, erros }
}
