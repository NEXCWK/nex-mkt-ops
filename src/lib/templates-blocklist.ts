import type { SupabaseClient } from '@supabase/supabase-js'

// Blocklist de templates excluídos manualmente, guardada como JSON no bucket
// "templates" (sem necessidade de migração de banco). O seed ("Importar
// Templates Novos") consulta essa lista e NÃO reimporta o que foi excluído.
const BLOCKLIST_PATH = '_config/excluidos.json'

export async function lerExcluidos(supabase: SupabaseClient): Promise<string[]> {
  try {
    const { data } = await supabase.storage.from('templates').download(BLOCKLIST_PATH)
    if (!data) return []
    const txt = await data.text()
    const arr = JSON.parse(txt)
    return Array.isArray(arr) ? arr.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}

async function salvar(supabase: SupabaseClient, tipos: string[]): Promise<void> {
  await supabase.storage.from('templates').upload(
    BLOCKLIST_PATH,
    new Blob([JSON.stringify(tipos)], { type: 'application/json' }),
    { contentType: 'application/json', upsert: true }
  )
}

export async function marcarExcluido(supabase: SupabaseClient, tipo: string): Promise<void> {
  const atual = await lerExcluidos(supabase)
  if (!atual.includes(tipo)) await salvar(supabase, [...atual, tipo])
}

export async function desmarcarExcluido(supabase: SupabaseClient, tipo: string): Promise<void> {
  const atual = await lerExcluidos(supabase)
  if (atual.includes(tipo)) await salvar(supabase, atual.filter(t => t !== tipo))
}
