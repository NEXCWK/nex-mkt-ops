import Anthropic from '@anthropic-ai/sdk'
import { askClaudeJSON } from '@/lib/anthropic'
import { createServerClient } from '@/lib/supabase/server'

export const KPIS_ATENDIMENTO = [
  'Cordialidade e tom de voz',
  'Tempo de resposta / agilidade',
  'Clareza e objetividade',
  'Entendimento da necessidade do cliente',
  'Conhecimento do produto/serviço',
  'Condução e técnica de venda (SPIN/qualificação)',
  'Resolução / encaminhamento',
  'Fechamento e próximos passos',
]

export const KPIS_TELEFONE = [
  'Saudação e identificação',
  'Clareza e dicção',
  'Escuta ativa',
  'Entendimento da necessidade do cliente',
  'Conhecimento do produto/serviço',
  'Condução e técnica de venda',
  'Cordialidade e empatia',
  'Encerramento e próximos passos',
]

export interface ConversaIA {
  atendente: string
  data: string | null
  nota: number
  resumo: string
  kpis: { nome: string; nota: number; comentario: string }[]
  pontos_atencao: { tipo: 'objecao' | 'atrito' | 'ponto_forte'; texto: string; trecho: string }[]
  palavras_chave: string[]
  trecho: string
}

export interface ResultadoAvaliacao {
  loteId: string
  totalConversas: number
  notaMedia: number
  conversas: Record<string, unknown>[]
}

/** Um item a avaliar: um arquivo (PDF nativo, ou texto já extraído/transcrito) ou um bloco de texto colado. */
export interface ItemParaAvaliar {
  nomeArquivo: string
  /** PDF nativo em base64 — enviado diretamente à IA (lida com PDFs de imagem/scan, sem depender de extração de texto). */
  pdfBase64?: string
  /** Texto já disponível (CSV/Excel/áudio transcrito/colado manualmente). */
  texto?: string
}

const MAX_TOKENS_POR_ITEM = 4000
/** Chamadas simultâneas à API — mantém lotes grandes (dezenas de arquivos) dentro do tempo de uma requisição HTTP. */
const CONCORRENCIA = 6
/** Limite de segurança para o tamanho do PDF em base64 (a API aceita até 32 MB por documento). */
const LIMITE_PDF_BASE64_BYTES = 28 * 1024 * 1024

function buildSystemPrompt(tipo: 'atendimento' | 'telefonema'): string {
  const canal = tipo === 'telefonema' ? 'atendimento por telefone' : 'atendimento via chat (RD Conversas)'
  const kpis = tipo === 'telefonema' ? KPIS_TELEFONE : KPIS_ATENDIMENTO

  return `Você é um analista de qualidade (QA) sênior do Nex Coworking (Curitiba/PR), especialista em avaliação de ${canal}.

Você recebe o conteúdo de UM arquivo/bloco por vez, que normalmente contém UM atendimento (mas ocasionalmente pode conter mais de uma conversa separada por marcadores como "---"). O conteúdo pode vir de um PDF nativo (inclusive PDFs de imagem/print de tela — leia o conteúdo visualmente), de uma planilha/CSV já convertida em texto, ou de texto colado manualmente. Em exports de PDF de chat (RD Conversas/Tallos) é comum a ordem de leitura ficar fora do padrão visual (ex.: linhas "Nome | data, hora | canal" agrupadas antes das mensagens correspondentes) — interprete com flexibilidade. Sua tarefa é:

1. Se houver mais de uma conversa no conteúdo, separe em atendimentos individuais; caso contrário, trate como uma única conversa.
2. Identificar o nome do atendente (procure por marcações como "Atendente:", assinatura, nome citado no início/fim da conversa, ou o nome do remetente das mensagens que não é o cliente — ex.: "*Letícia:* ..." ou "Letícia | data, hora | whatsapp").
3. DESCARTAR conversas SEM NENHUMA INTERAÇÃO REAL: se o conteúdo mostrar apenas o(a) atendente encerrando/finalizando a conversa (ou uma mensagem automática de encerramento do sistema), sem nenhuma troca de mensagens relevante entre atendente e cliente, essa conversa NÃO deve entrar na lista "conversas" — não avalie, não pontue, não conte. É como se o atendimento não tivesse existido.
4. Avaliar CADA conversa restante (com interação real) individualmente nos KPIs abaixo (nota de 0 a 10, uma casa decimal):
${kpis.map(k => `- ${k}`).join('\n')}
5. Para cada conversa, extrair os principais pontos de atenção: objeções do cliente, pontos de atrito, ou pontos fortes, cada um com um TRECHO EXATO de onde foi extraído (cite literalmente, mas condense em UMA ÚNICA LINHA — sem quebras de linha dentro do trecho).
6. Extrair de 3 a 8 palavras-chave relevantes do assunto tratado (evite palavras genéricas como "olá", "obrigado").

Regras:
- Seja honesto nas notas: baseie-se apenas no que está no conteúdo.
- Se não conseguir identificar o atendente de uma conversa COM interação real, use "Atendente não Reconhecido" — NUNCA descarte uma conversa com interação real só por não conseguir identificar o atendente (descarte APENAS conversas sem interação real, conforme a regra 3).
- Se não conseguir identificar a data, use null.
- "trecho" deve ser um recorte representativo (até ~400 caracteres), em uma única linha, sem quebras de linha.
- Se não conseguir separar claramente o conteúdo em múltiplas conversas (mas houver interação real), trate o conteúdo inteiro como UMA ÚNICA conversa e avalie mesmo assim, usando "Atendente não Reconhecido" se necessário — uma avaliação aproximada é sempre melhor do que nenhuma. Isso só se aplica quando HÁ interação real; se não houver, siga a regra 3 e retorne uma lista vazia.

Responda em JSON:
{
  "conversas": [
    {
      "atendente": "nome do atendente",
      "data": "YYYY-MM-DD ou null",
      "nota": 0-10,
      "resumo": "resumo curto e objetivo desta conversa",
      "kpis": [ { "nome": "<exatamente o nome do KPI>", "nota": 0-10, "comentario": "observação curta" } ],
      "pontos_atencao": [ { "tipo": "objecao|atrito|ponto_forte", "texto": "descrição curta", "trecho": "trecho literal" } ],
      "palavras_chave": ["palavra1", "palavra2"],
      "trecho": "recorte representativo"
    }
  ]
}`
}

function conversaFallback(item: ItemParaAvaliar, motivo?: string): ConversaIA {
  return {
    atendente: 'Atendente não Reconhecido',
    data: null,
    nota: 0,
    resumo: motivo
      ? `Falha ao avaliar "${item.nomeArquivo}": ${motivo}.`
      : `Não foi possível avaliar automaticamente "${item.nomeArquivo}".`,
    kpis: [],
    pontos_atencao: [],
    palavras_chave: [],
    trecho: (item.texto ?? '').slice(0, 400),
  }
}

/** Avalia um único item (PDF nativo ou texto) via IA. Nunca lança — falhas viram uma conversa-fallback isolada. */
async function avaliarItem(item: ItemParaAvaliar, system: string, funcionalidade: string, operadorEmail: string): Promise<ConversaIA[]> {
  try {
    if (item.pdfBase64 && Buffer.byteLength(item.pdfBase64, 'base64') > LIMITE_PDF_BASE64_BYTES) {
      return [conversaFallback(item, 'arquivo PDF muito grande (acima de ~28 MB) — divida-o em partes menores')]
    }

    const user: Array<Anthropic.Messages.ContentBlockParam> | string = item.pdfBase64
      ? [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: item.pdfBase64 } },
          { type: 'text', text: `Arquivo: ${item.nomeArquivo}. Avalie o(s) atendimento(s) deste PDF conforme as instruções do sistema.` },
        ]
      : `Arquivo: ${item.nomeArquivo}\n\n${item.texto ?? ''}`

    const result = await comRetryTransiente(() => askClaudeJSON<{ conversas: ConversaIA[] }>({
      system,
      user,
      maxTokens: MAX_TOKENS_POR_ITEM,
      funcionalidade,
      operadorEmail,
    }))

    // Uma lista vazia aqui é uma resposta legítima (ex.: a conversa só teve encerramento
    // automático, sem interação real, e foi corretamente descartada pela IA) — não é falha.
    return Array.isArray(result.conversas) ? result.conversas : [conversaFallback(item)]
  } catch (e) {
    // Falha isolada em UM arquivo não deve derrubar o lote inteiro — os demais continuam normalmente.
    return [conversaFallback(item, e instanceof Error ? e.message : 'erro desconhecido')]
  }
}

/**
 * Repete uma vez, após uma pequena espera, chamadas que falharam por erro transitório
 * da API (sobrecarga/limite de taxa) — comum ao avaliar dezenas de arquivos em paralelo.
 */
async function comRetryTransiente<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    const status = (e as { status?: number } | null)?.status
    if (status === 429 || status === 500 || status === 503 || status === 529) {
      await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000))
      return fn()
    }
    throw e
  }
}

/** Executa `fn` sobre `items` com no máximo `limite` chamadas simultâneas. */
async function comConcorrenciaLimitada<T, R>(items: T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      resultados[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, worker))
  return resultados
}

/**
 * Avalia uma lista de itens (arquivos PDF nativos, textos extraídos/transcritos ou texto colado) com IA,
 * separando por conversa/atendente, e persiste em avaliacoes_lotes + avaliacoes_conversas.
 *
 * Cada item é avaliado em uma chamada de IA independente (com concorrência limitada), o que:
 * - evita estourar o limite de tokens de saída ao lidar com dezenas de arquivos de uma vez;
 * - permite que PDFs sejam lidos nativamente pela IA (inclusive PDFs de imagem/scan, sem depender
 *   de extração de texto que falha silenciosamente nesses casos);
 * - isola falhas: um arquivo problemático vira uma conversa-fallback em vez de derrubar o lote inteiro.
 */
export async function avaliarTranscricoes(opts: {
  tipo: 'atendimento' | 'telefonema'
  itens: ItemParaAvaliar[]
  operadorEmail: string
}): Promise<ResultadoAvaliacao> {
  const { tipo, itens, operadorEmail } = opts
  const funcionalidade = tipo === 'telefonema' ? 'avaliacao_telefonemas' : 'avaliacao_atendimentos'
  const system = buildSystemPrompt(tipo)

  const porItem = await comConcorrenciaLimitada(itens, CONCORRENCIA, item => avaliarItem(item, system, funcionalidade, operadorEmail))
  const conversas = porItem.flat()

  const notaMedia = conversas.length > 0 ? conversas.reduce((s, c) => s + (c.nota || 0), 0) / conversas.length : 0

  const nomeArquivo = itens.length === 1
    ? itens[0].nomeArquivo
    : itens.length <= 5
      ? `${itens.length} arquivos (${itens.map(i => i.nomeArquivo).join(', ')})`
      : `${itens.length} arquivos (${itens.slice(0, 3).map(i => i.nomeArquivo).join(', ')}, …)`

  const supabase = createServerClient()
  const { data: lote, error: erroLote } = await supabase
    .from('avaliacoes_lotes')
    .insert({
      tipo,
      nome_arquivo: nomeArquivo,
      total_conversas: conversas.length,
      nota_media: notaMedia,
      operador_email: operadorEmail,
    })
    .select()
    .single()

  if (erroLote) throw new Error(erroLote.message)

  const linhas = conversas.map(c => ({
    lote_id: lote.id,
    tipo,
    atendente: c.atendente || 'Atendente não Reconhecido',
    data: c.data || null,
    nota: c.nota,
    resumo: c.resumo,
    kpis: c.kpis ?? [],
    pontos_atencao: c.pontos_atencao ?? [],
    palavras_chave: c.palavras_chave ?? [],
    trecho: c.trecho ?? '',
  }))

  if (linhas.length > 0) {
    const { error: erroConversas } = await supabase.from('avaliacoes_conversas').insert(linhas)
    if (erroConversas) throw new Error(erroConversas.message)
  }

  return { loteId: lote.id, totalConversas: conversas.length, notaMedia, conversas: linhas }
}
