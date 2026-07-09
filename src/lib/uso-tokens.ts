import { createServerClient } from '@/lib/supabase/server'

/** Preços por milhão de tokens (USD). Ajuste aqui quando os preços mudarem. */
export const PRECOS_MODELO: Record<string, { input: number; output: number }> = {
  // Sonnet 5: preço promocional vigente até 2026-08-31 (depois volta a $3/$15)
  'claude-sonnet-5': { input: 2.0, output: 10.0 },
  'claude-opus-4-8': { input: 5.0, output: 25.0 },
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
}

export function estimarCustoUsd(modelo: string, tokensInput: number, tokensOutput: number): number | null {
  const preco = PRECOS_MODELO[modelo]
  if (!preco) return null
  return (tokensInput / 1_000_000) * preco.input + (tokensOutput / 1_000_000) * preco.output
}

/** Registra uma chamada à API Claude para permitir análise de custo por funcionalidade. Nunca lança erro. */
export async function registrarUsoTokens(opts: {
  funcionalidade: string
  modelo: string
  tokensInput: number
  tokensOutput: number
  operadorEmail?: string | null
}) {
  try {
    const custoEstimadoUsd = estimarCustoUsd(opts.modelo, opts.tokensInput, opts.tokensOutput)
    const supabase = createServerClient()
    await supabase.from('uso_tokens').insert({
      funcionalidade: opts.funcionalidade,
      modelo: opts.modelo,
      tokens_input: opts.tokensInput,
      tokens_output: opts.tokensOutput,
      custo_estimado_usd: custoEstimadoUsd,
      operador_email: opts.operadorEmail ?? null,
    })
  } catch {
    // registro de uso não deve nunca quebrar o fluxo principal
  }
}
