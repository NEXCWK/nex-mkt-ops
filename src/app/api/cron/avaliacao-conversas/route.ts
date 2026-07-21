import { NextRequest, NextResponse } from 'next/server'
import { assertApiKey } from '@/lib/anthropic'
import { createServerClient } from '@/lib/supabase/server'
import { exportarTranscricoes } from '@/lib/rd-conversas'
import { avaliarTranscricoes } from '@/lib/avaliacao-core'

export const dynamic = 'force-dynamic'
export const maxDuration = 600

/**
 * Execução automática (chamada pelo GitHub Actions cron, diariamente às 20h BRT).
 *
 * Janela: da última execução bem-sucedida até agora. Na primeira execução,
 * cobre as últimas 24h. É possível sobrescrever com ?de=ISO&ate=ISO (backfill).
 *
 * Autenticação: header `x-cron-secret` OU `?secret=` deve bater com CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secretEsperado = process.env.CRON_SECRET
  const secretRecebido =
    req.headers.get('x-cron-secret') ??
    req.nextUrl.searchParams.get('secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')

  if (!secretEsperado || secretRecebido !== secretEsperado) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const apiErr = assertApiKey()
  if (apiErr) return NextResponse.json({ error: apiErr }, { status: 500 })

  if (!process.env.RD_CONVERSAS_TOKEN) {
    return NextResponse.json({ error: 'RD_CONVERSAS_TOKEN não configurado' }, { status: 500 })
  }

  const supabase = createServerClient()
  const agora = new Date()

  // Janela: parâmetros manuais têm prioridade; senão, da última execução ok até agora.
  const deParam = req.nextUrl.searchParams.get('de')
  const ateParam = req.nextUrl.searchParams.get('ate')

  let de: string
  const ate = ateParam ?? agora.toISOString()

  if (deParam) {
    de = deParam
  } else {
    const { data: ultimo } = await supabase
      .from('avaliacao_cron_log')
      .select('janela_ate')
      .eq('status', 'ok')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    de = ultimo?.janela_ate ?? new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString()
  }

  try {
    const { blocos, totalConversas, diagnostico } = await exportarTranscricoes(de, ate)

    if (blocos.length === 0 || totalConversas === 0) {
      await supabase.from('avaliacao_cron_log').insert({
        janela_de: de, janela_ate: ate, total_conversas: 0, status: 'vazio',
        detalhe: diagnostico.erro ?? 'Nenhuma conversa com mensagens no período.',
      })
      return NextResponse.json({ status: 'vazio', de, ate, diagnostico })
    }

    const janela = `${de.slice(0, 16)} → ${ate.slice(0, 16)}`
    const resultado = await avaliarTranscricoes({
      tipo: 'atendimento',
      // Um item por conversa (não um único bloco gigante) — evita estourar o limite de
      // tokens de saída da IA quando a janela do dia tem muitas conversas.
      itens: blocos.map((texto, i) => ({ nomeArquivo: `RD Conversas · ${janela} · conversa ${i + 1}`, texto })),
      operadorEmail: 'cron@nex.work',
    })

    await supabase.from('avaliacao_cron_log').insert({
      janela_de: de, janela_ate: ate, total_conversas: totalConversas,
      lote_id: resultado.loteId, status: 'ok',
      detalhe: `${resultado.totalConversas} conversa(s) avaliada(s), nota média ${resultado.notaMedia.toFixed(1)}`,
    })

    return NextResponse.json({
      status: 'ok', de, ate,
      totalConversas,
      loteId: resultado.loteId,
      notaMedia: resultado.notaMedia,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    await supabase.from('avaliacao_cron_log').insert({
      janela_de: de, janela_ate: ate, total_conversas: 0, status: 'erro', detalhe: msg,
    })
    return NextResponse.json({ status: 'erro', error: msg, de, ate }, { status: 500 })
  }
}
