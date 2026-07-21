import Anthropic from '@anthropic-ai/sdk'
import { registrarUsoTokens } from '@/lib/uso-tokens'

export const CLAUDE_MODEL = 'claude-sonnet-5'
/** Modelo mais rápido/barato — usado em tarefas simples (ex.: resumos) para economizar tokens. */
export const CLAUDE_HAIKU_MODEL = 'claude-haiku-4-5-20251001'

/** Cliente Anthropic — lê ANTHROPIC_API_KEY das variáveis de ambiente (Railway). */
export function getAnthropic(): Anthropic {
  return new Anthropic()
}

export function assertApiKey(): string | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    return 'ANTHROPIC_API_KEY não configurada no ambiente. Adicione a variável no Railway.'
  }
  return null
}

/**
 * Chama o Claude pedindo uma resposta exclusivamente em JSON e devolve o objeto
 * já parseado. Tolerante a cercas ```json e a texto antes/depois do bloco.
 */
export async function askClaudeJSON<T = unknown>(opts: {
  system: string
  /** Texto simples, ou blocos de conteúdo (ex.: documento PDF nativo + texto) para entradas multimodais. */
  user: string | Array<Anthropic.Messages.ContentBlockParam>
  maxTokens?: number
  /** Rótulo da funcionalidade (para rastreamento de custo/uso de tokens). */
  funcionalidade?: string
  operadorEmail?: string | null
}): Promise<T> {
  const client = getAnthropic()
  const res = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    // Extração/classificação estruturada não precisa de raciocínio estendido — desliga para reduzir latência
    // (no Sonnet 5, omitir esse campo liga "adaptive thinking" por padrão, o que pode ultrapassar timeouts de proxy).
    thinking: { type: 'disabled' },
    system: [
      {
        type: 'text',
        text: opts.system + '\n\nResponda SEMPRE e EXCLUSIVAMENTE com um JSON válido, sem texto antes ou depois, sem cercas de markdown. Ao citar trechos literais de texto de várias linhas dentro de um valor string, escape corretamente as quebras de linha como \\n (nunca insira uma quebra de linha crua dentro de uma string JSON).',
      },
    ],
    messages: [{ role: 'user', content: opts.user }],
  })

  if (opts.funcionalidade) {
    void registrarUsoTokens({
      funcionalidade: opts.funcionalidade,
      modelo: CLAUDE_MODEL,
      tokensInput: res.usage.input_tokens,
      tokensOutput: res.usage.output_tokens,
      operadorEmail: opts.operadorEmail,
    })
  }

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')

  return parseJSON<T>(text)
}

/** Chama o modelo Haiku (mais barato) pedindo texto simples, sem JSON. */
export async function askHaikuText(opts: {
  system: string
  user: string
  maxTokens?: number
  /** Rótulo da funcionalidade (para rastreamento de custo/uso de tokens). */
  funcionalidade?: string
  operadorEmail?: string | null
}): Promise<string> {
  const client = getAnthropic()
  const res = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 1500,
    thinking: { type: 'disabled' },
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  })

  if (opts.funcionalidade) {
    void registrarUsoTokens({
      funcionalidade: opts.funcionalidade,
      modelo: CLAUDE_MODEL,
      tokensInput: res.usage.input_tokens,
      tokensOutput: res.usage.output_tokens,
      operadorEmail: opts.operadorEmail,
    })
  }

  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()
}

/**
 * Escapa quebras de linha/tab/carriage-return "cruas" que aparecem DENTRO de
 * strings JSON. É comum a IA citar trechos literais de transcrições
 * multi-linha (ex.: campo "trecho") sem escapá-los corretamente como \n, o
 * que deixa o JSON tecnicamente inválido mesmo com o conteúdo semanticamente
 * correto. Percorre caractere a caractere rastreando se está dentro de uma
 * string e se o caractere anterior foi um escape, para não mexer em
 * espaçamento fora de strings.
 */
function escaparControlChars(txt: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i]
    if (!inString) {
      if (ch === '"') inString = true
      out += ch
      continue
    }
    if (escaped) {
      out += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      out += ch
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = false
      out += ch
      continue
    }
    if (ch === '\n') { out += '\\n'; continue }
    if (ch === '\r') { out += '\\r'; continue }
    if (ch === '\t') { out += '\\t'; continue }
    out += ch
  }
  return out
}

/**
 * Escapa aspas duplas "internas" (que a IA esqueceu de escapar como \") dentro
 * de um valor string — causa comum do erro "Expected ',' or ']' after array
 * element". Usa uma heurística de lookahead: uma aspas só é tratada como o
 * FECHAMENTO da string se o próximo caractere não-espaço for um separador
 * JSON válido (, } ] :) ou o fim do texto; caso contrário, é conteúdo da
 * própria string e precisa ser escapada.
 */
function repararAspasInternas(txt: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i]
    if (!inString) {
      if (ch === '"') inString = true
      out += ch
      continue
    }
    if (escaped) {
      out += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      out += ch
      escaped = true
      continue
    }
    if (ch === '"') {
      let j = i + 1
      while (j < txt.length && /\s/.test(txt[j])) j++
      const proximo = txt[j]
      const fechaString = proximo === undefined || [',', '}', ']', ':'].includes(proximo)
      if (fechaString) {
        inString = false
        out += ch
      } else {
        out += '\\"'
      }
      continue
    }
    out += ch
  }
  return out
}

export function parseJSON<T>(raw: string): T {
  let txt = raw.trim()
  // remove cercas ```json ... ```
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) txt = fence[1].trim()
  // recorta do primeiro { ou [ até o último } ou ]
  const firstObj = txt.indexOf('{')
  const firstArr = txt.indexOf('[')
  const start = firstArr === -1 ? firstObj : firstObj === -1 ? firstArr : Math.min(firstObj, firstArr)
  const lastObj = txt.lastIndexOf('}')
  const lastArr = txt.lastIndexOf(']')
  const end = Math.max(lastObj, lastArr)
  if (start !== -1 && end !== -1) txt = txt.slice(start, end + 1)

  // Tenta em ordem crescente de agressividade: estrito -> controle escapado -> + aspas internas escapadas
  const tentativas = [
    () => JSON.parse(txt) as T,
    () => JSON.parse(escaparControlChars(txt)) as T,
    () => JSON.parse(repararAspasInternas(escaparControlChars(txt))) as T,
  ]

  let erroOriginal: unknown
  for (const tentativa of tentativas) {
    try {
      return tentativa()
    } catch (e) {
      if (erroOriginal === undefined) erroOriginal = e
    }
  }

  throw new Error(
    erroOriginal instanceof Error
      ? `A IA devolveu um JSON malformado (${erroOriginal.message}). Tente novamente — se persistir, tente com menos arquivos por vez.`
      : 'A IA devolveu uma resposta em formato inesperado. Tente novamente.'
  )
}
