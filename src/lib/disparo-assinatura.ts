import { createServerClient } from '@/lib/supabase/server'

/** Busca a URL da imagem de assinatura cadastrada para um remetente de disparo (ou null se não houver). */
export async function buscarAssinaturaDisparo(remetente: string): Promise<string | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('disparo_assinaturas')
    .select('url')
    .eq('remetente', remetente)
    .maybeSingle()
  return data?.url ?? null
}
