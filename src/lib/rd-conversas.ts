/**
 * Integração com o RD Conversas via MCP (Streamable HTTP).
 *
 * Exporta as conversas/atendimentos de uma janela de tempo e monta um texto de
 * transcrições agrupado por atendente, pronto para o pipeline de avaliação.
 *
 * Como os nomes exatos das tools do servidor podem variar, usamos auto-descoberta
 * por palavra-chave, com fallback para variações de nomes de parâmetros.
 */

import { createMcpClient, firstArray, type MCPTool } from '@/lib/mcp-client'

export function getConversasMcpUrl(): string {
  const url = process.env.RD_CONVERSAS_MCP_URL
  if (!url) throw new Error('RD_CONVERSAS_MCP_URL não configurada no ambiente (Railway).')
  return url
}

interface Mensagem {
  autor?: string
  de?: string
  texto?: string
  mensagem?: string
  content?: string
  body?: string
  timestamp?: string
  created_at?: string
  [k: string]: unknown
}

interface Conversa {
  id?: string
  _id?: string
  atendente?: string
  agente?: string
  employee?: string
  operador?: string
  contato?: string
  cliente?: string
  created_at?: string
  data?: string
  mensagens?: Mensagem[]
  messages?: Mensagem[]
  [k: string]: unknown
}

function textoMensagem(m: Mensagem): string {
  const autor = m.autor ?? m.de ?? (typeof m.from === 'string' ? m.from : '') ?? ''
  const txt = m.texto ?? m.mensagem ?? m.content ?? m.body ?? ''
  if (!txt) return ''
  return autor ? `${autor}: ${txt}` : String(txt)
}

function nomeAtendente(c: Conversa): string {
  return (
    c.atendente ?? c.agente ?? c.employee ?? c.operador ??
    (typeof c.agent === 'string' ? c.agent : '') ??
    'Não identificado'
  ) as string
}

/**
 * Busca conversas na janela [de, ate] (ISO) e retorna um texto de transcrições.
 * Retorna também um diagnóstico com as tools disponíveis e o que foi usado.
 */
export async function exportarTranscricoes(de: string, ate: string): Promise<{
  texto: string
  totalConversas: number
  diagnostico: { tools: string[]; toolConversasUsada: string | null; toolMensagensUsada: string | null; erro?: string }
}> {
  const mcp = createMcpClient(getConversasMcpUrl())
  const tools = await mcp.listTools()
  const nomesTools = tools.map((t: MCPTool) => t.name)

  // 1. Tool que lista conversas/atendimentos
  const toolConversas = await mcp.pickTool([
    'conversation', 'conversa', 'atendimento', 'ticket', 'chat', 'historico', 'history',
  ])

  const diag = {
    tools: nomesTools,
    toolConversasUsada: toolConversas,
    toolMensagensUsada: null as string | null,
  }

  if (!toolConversas) {
    return {
      texto: '',
      totalConversas: 0,
      diagnostico: { ...diag, erro: 'Nenhuma tool de listagem de conversas encontrada no RD Conversas MCP.' },
    }
  }

  // Tenta várias combinações de parâmetros de data/paginação
  const paramVariants: Record<string, unknown>[] = [
    { start_date: de, end_date: ate },
    { data_inicio: de, data_fim: ate },
    { de, ate },
    { from: de, to: ate },
    { created_after: de, created_before: ate },
    { filter: `created_at:>=${de.slice(0, 10)} created_at:<=${ate.slice(0, 10)}` },
  ]

  let conversas: Conversa[] = []
  for (const variant of paramVariants) {
    try {
      const res = await mcp.callTool<unknown>(toolConversas, { ...variant, page: 1, per_page: 200, limit: 200 })
      const arr = firstArray(res, ['conversations', 'conversas', 'atendimentos', 'tickets', 'data', 'items', 'records', 'results'])
      if (arr.length > 0) {
        conversas = arr as Conversa[]
        break
      }
    } catch { /* tenta a próxima variação */ }
  }

  // 2. Tool para buscar mensagens de uma conversa (caso as conversas não venham com o histórico embutido)
  const primeiraTemMensagens = conversas[0] && (
    Array.isArray(conversas[0].mensagens) || Array.isArray(conversas[0].messages)
  )
  let toolMensagens: string | null = null
  if (!primeiraTemMensagens && conversas.length > 0) {
    toolMensagens = await mcp.pickTool(['message', 'mensage', 'historico', 'history', 'transcript', 'transcricao'])
    diag.toolMensagensUsada = toolMensagens
  }

  // 3. Monta o texto de transcrições, agrupado por conversa
  const blocos: string[] = []
  for (const c of conversas) {
    const id = (c.id ?? c._id ?? '') as string
    const atendente = nomeAtendente(c)
    const dataConversa = (c.created_at ?? c.data ?? '') as string

    let mensagens: Mensagem[] = c.mensagens ?? c.messages ?? []

    if (mensagens.length === 0 && toolMensagens && id) {
      for (const variant of [{ conversation_id: id }, { conversa_id: id }, { id }, { ticket_id: id }]) {
        try {
          const res = await mcp.callTool<unknown>(toolMensagens, variant)
          const arr = firstArray(res, ['messages', 'mensagens', 'data', 'items', 'records'])
          if (arr.length > 0) { mensagens = arr as Mensagem[]; break }
        } catch { /* tenta a próxima */ }
      }
    }

    const linhas = mensagens.map(textoMensagem).filter(Boolean)
    if (linhas.length === 0) continue

    blocos.push(
      `[Atendente: ${atendente}]${dataConversa ? ` [Data: ${dataConversa.slice(0, 10)}]` : ''}\n${linhas.join('\n')}`
    )
  }

  return {
    texto: blocos.join('\n\n---\n\n'),
    totalConversas: blocos.length,
    diagnostico: diag,
  }
}

/** Probe: retorna as tools disponíveis no RD Conversas MCP e o trace bruto. */
export async function probeConversas() {
  const mcp = createMcpClient(getConversasMcpUrl())
  return mcp.probe()
}
