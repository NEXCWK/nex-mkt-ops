import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { podeAcessarDashboardAvaliacao } from '@/lib/acesso-restrito'
import { askClaudeJSON, assertApiKey, CLAUDE_HAIKU_MODEL } from '@/lib/anthropic'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

interface ConversaRow {
  id: string
  atendente: string
  resumo: string
  trecho: string
  nota: number
}

/**
 * Reclassifica retroativamente as conversas de um lote já salvo, removendo as que não
 * tiveram nenhuma interação real (apenas encerramento automático) — a mesma regra que
 * novos envios já aplicam automaticamente, aplicada aqui a um lote enviado anteriormente.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!podeAcessarDashboardAvaliacao(session.user.email)) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })
  }

  const apiErr = assertApiKey()
  if (apiErr) return NextResponse.json({ error: apiErr }, { status: 500 })

  try {
    const body = await req.json().catch(() => ({}))
    const tipo: 'atendimento' | 'telefonema' = body.tipo === 'telefonema' ? 'telefonema' : 'atendimento'
    let loteId: string | undefined = body.loteId

    const supabase = createServerClient()

    if (!loteId) {
      const { data: ultimoLote, error: erroUltimo } = await supabase
        .from('avaliacoes_lotes')
        .select('id')
        .eq('tipo', tipo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (erroUltimo) return NextResponse.json({ error: erroUltimo.message }, { status: 500 })
      if (!ultimoLote) return NextResponse.json({ error: 'Nenhum lote encontrado' }, { status: 404 })
      loteId = ultimoLote.id
    }

    const { data: conversas, error: erroConversas } = await supabase
      .from('avaliacoes_conversas')
      .select('id, atendente, resumo, trecho, nota')
      .eq('lote_id', loteId)

    if (erroConversas) return NextResponse.json({ error: erroConversas.message }, { status: 500 })
    if (!conversas || conversas.length === 0) {
      return NextResponse.json({ removidas: 0, restantes: 0, mensagem: 'Lote sem conversas para analisar.' })
    }

    const lista = (conversas as ConversaRow[])
      .map((c, i) => `${i}. Atendente: ${c.atendente} | Resumo: ${c.resumo || '(sem resumo)'} | Trecho: ${(c.trecho || '').slice(0, 300)}`)
      .join('\n')

    const system = `Você é um analista de QA. Você recebe uma lista numerada de atendimentos já avaliados anteriormente (resumo + trecho representativo de cada um). Identifique quais NÃO tiveram nenhuma interação real entre atendente e cliente — ou seja, o conteúdo mostra apenas o(a) atendente ou o sistema encerrando/finalizando a conversa automaticamente, sem nenhuma troca de mensagens relevante. Responda em JSON: { "indices_sem_interacao": [0, 3, 7] } com os índices (0-based) desses casos. Se nenhum se enquadrar, responda { "indices_sem_interacao": [] }.`

    const resultado = await askClaudeJSON<{ indices_sem_interacao: number[] }>({
      system,
      user: `Lista de atendimentos:\n${lista}`,
      maxTokens: 4000,
      funcionalidade: 'avaliacao_limpar_sem_interacao',
      operadorEmail: session.user.email,
      model: CLAUDE_HAIKU_MODEL,
    })

    const indices = new Set(Array.isArray(resultado.indices_sem_interacao) ? resultado.indices_sem_interacao : [])
    const idsParaRemover = (conversas as ConversaRow[]).filter((_, i) => indices.has(i)).map(c => c.id)

    if (idsParaRemover.length > 0) {
      const { error: erroDelete } = await supabase.from('avaliacoes_conversas').delete().in('id', idsParaRemover)
      if (erroDelete) return NextResponse.json({ error: erroDelete.message }, { status: 500 })
    }

    const restantes = (conversas as ConversaRow[]).filter(c => !idsParaRemover.includes(c.id))
    const notaMedia = restantes.length > 0 ? restantes.reduce((s, c) => s + (c.nota || 0), 0) / restantes.length : 0

    await supabase
      .from('avaliacoes_lotes')
      .update({ total_conversas: restantes.length, nota_media: notaMedia })
      .eq('id', loteId)

    return NextResponse.json({
      loteId,
      removidas: idsParaRemover.length,
      restantes: restantes.length,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao limpar o lote' }, { status: 500 })
  }
}
