import Anthropic from '@anthropic-ai/sdk'

export const CLAUDE_MODEL = 'claude-opus-4-8'

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
  user: string
  maxTokens?: number
}): Promise<T> {
  const client = getAnthropic()
  const res = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    system: [
      {
        type: 'text',
        text: opts.system + '\n\nResponda SEMPRE e EXCLUSIVAMENTE com um JSON válido, sem texto antes ou depois, sem cercas de markdown.',
      },
    ],
    messages: [{ role: 'user', content: opts.user }],
  })

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')

  return parseJSON<T>(text)
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
  return JSON.parse(txt) as T
}
