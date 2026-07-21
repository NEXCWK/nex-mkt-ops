/**
 * Exportação de conversas do RD Station Conversas (API REST v2 / Tallos) para o
 * pipeline de avaliação. Busca o histórico de mensagens de uma janela de tempo e
 * monta um texto de transcrições agrupado por conversa e atendente.
 *
 * Os nomes de campos da resposta podem variar; a extração é defensiva.
 */

import { apiGet } from '@/lib/rd-conversas-rest'
import { firstArray } from '@/lib/mcp-client'

interface Mensagem {
  [k: string]: unknown
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

function get(obj: Mensagem, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) return v
    if (typeof v === 'number') return String(v)
    if (v && typeof v === 'object') {
      const nested = (v as Record<string, unknown>)
      for (const nk of ['name', 'nome', 'id', '_id']) {
        if (typeof nested[nk] === 'string' && (nested[nk] as string).trim()) return nested[nk] as string
      }
    }
  }
  return ''
}

function textoMensagem(m: Mensagem): string {
  const conteudo = get(m, ['content', 'text', 'texto', 'message', 'mensagem', 'body'])
  if (!conteudo) return ''
  // quem falou: atendente/funcionário vs contato/cliente
  const autor =
    get(m, ['employee', 'agent', 'atendente', 'funcionario', 'operator', 'user']) ||
    get(m, ['contact', 'contato', 'cliente', 'customer']) ||
    (str(m.fromMe) === 'true' || m.fromMe === true ? 'Atendente' : 'Cliente')
  return `${autor}: ${conteudo}`
}

function chaveConversa(m: Mensagem): string {
  return get(m, ['conversation', 'conversation_id', 'ticket', 'ticket_id', 'chat', 'chat_id', 'protocol', 'protocolo', 'contact', 'contato']) || 'sem-conversa'
}

function atendenteConversa(m: Mensagem): string {
  return get(m, ['employee', 'agent', 'atendente', 'funcionario', 'operator']) || 'Não identificado'
}

function dataMensagem(m: Mensagem): string {
  return get(m, ['created_at', 'createdAt', 'timestamp', 'date', 'data']).slice(0, 10)
}

/**
 * Busca o histórico de conversas na janela [de, ate] (ISO) e retorna um texto de
 * transcrições, paginando automaticamente.
 */
export async function exportarTranscricoes(de: string, ate: string): Promise<{
  texto: string
  /** Cada bloco é uma conversa individual (mesmo conteúdo de `texto`, já separado — evita 1 chamada de IA gigante). */
  blocos: string[]
  totalConversas: number
  diagnostico: { status: number; paramUsado: Record<string, string> | null; totalMensagens: number; erro?: string }
}> {
  const paramVariants: Record<string, string>[] = [
    { start: de, end: ate },
    { startDate: de, endDate: ate },
    { start_date: de, end_date: ate },
    { from: de, to: ate },
    { initialDate: de, finalDate: ate },
  ]

  let mensagens: Mensagem[] = []
  let paramUsado: Record<string, string> | null = null
  let statusFinal = 0

  for (const variant of paramVariants) {
    // pagina até 25 páginas por segurança
    const acumulado: Mensagem[] = []
    let page = 1
    let ok = false
    while (page <= 25) {
      const { ok: reqOk, status, json } = await apiGet('/messages/history', { ...variant, page, limit: 200 })
      statusFinal = status
      if (!reqOk) break
      ok = true
      const arr = firstArray(json, ['messages', 'mensagens', 'history', 'historico', 'data', 'items', 'records', 'results']) as Mensagem[]
      acumulado.push(...arr)
      if (arr.length < 200) break
      page++
    }
    if (ok && acumulado.length > 0) {
      mensagens = acumulado
      paramUsado = variant
      break
    }
    if (ok && acumulado.length === 0) { paramUsado = variant; break } // funcionou mas sem dados
  }

  if (mensagens.length === 0) {
    return {
      texto: '',
      blocos: [],
      totalConversas: 0,
      diagnostico: {
        status: statusFinal,
        paramUsado,
        totalMensagens: 0,
        erro: statusFinal === 401 || statusFinal === 403
          ? 'API recusou o acesso (401/403). Verifique o token e se o plano libera o histórico de conversas.'
          : statusFinal === 0 ? 'Não foi possível contatar a API do RD Conversas.' : undefined,
      },
    }
  }

  // Agrupa por conversa
  const grupos = new Map<string, { atendente: string; data: string; linhas: string[] }>()
  for (const m of mensagens) {
    const chave = chaveConversa(m)
    const linha = textoMensagem(m)
    if (!linha) continue
    const g = grupos.get(chave) ?? { atendente: atendenteConversa(m), data: dataMensagem(m), linhas: [] }
    if (g.atendente === 'Não identificado') g.atendente = atendenteConversa(m)
    if (!g.data) g.data = dataMensagem(m)
    g.linhas.push(linha)
    grupos.set(chave, g)
  }

  const blocos: string[] = []
  for (const g of grupos.values()) {
    if (g.linhas.length === 0) continue
    blocos.push(`[Atendente: ${g.atendente}]${g.data ? ` [Data: ${g.data}]` : ''}\n${g.linhas.join('\n')}`)
  }

  return {
    texto: blocos.join('\n\n---\n\n'),
    blocos,
    totalConversas: blocos.length,
    diagnostico: { status: statusFinal, paramUsado, totalMensagens: mensagens.length },
  }
}
