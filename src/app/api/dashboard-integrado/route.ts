import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { podeAcessarDashboardAvaliacao } from '@/lib/acesso-restrito'

export const dynamic = 'force-dynamic'

/**
 * Métricas "estáticas" (não têm canal de tempo real próprio) do restante do
 * sistema, para complementar o Dashboard Integrado: Contratos, E-mails,
 * Prospecção (BDR/Parcerias), Sistema CCO, Avaliação de Qualidade e Uso de
 * Tokens. Cada bloco respeita a mesma restrição de acesso da sua aba original.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const de = searchParams.get('de')
  const ate = searchParams.get('ate')
  const desde = de ? `${de}T00:00:00` : undefined
  const ateFim = ate ? `${ate}T23:59:59` : undefined

  const supabase = createServerClient()
  const perfil = session.user.perfil ?? 'operador'
  const podeVerTokens = perfil === 'gestor' || perfil === 'admin'
  const podeVerCco = perfil === 'gestor' || perfil === 'admin'
  const podeVerAvaliacao = podeAcessarDashboardAvaliacao(session.user.email)

  function comPeriodo<T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(q: T, coluna: string): T {
    let r = q
    if (desde) r = r.gte(coluna, desde)
    if (ateFim) r = r.lte(coluna, ateFim)
    return r
  }

  const [contratosRes, emailsRes, listasRes, ccoRes, lotesRes, tokensRes] = await Promise.all([
    comPeriodo(supabase.from('documentos_gerados').select('id', { count: 'exact', head: true }), 'created_at'),
    comPeriodo(supabase.from('emails_enviados').select('id', { count: 'exact', head: true }), 'sent_at'),
    comPeriodo(supabase.from('prospeccao_listas').select('tipo, empresas'), 'created_at'),
    podeVerCco
      ? supabase.from('cco_contatos').select('id', { count: 'exact', head: true })
      : Promise.resolve({ count: null, data: null, error: null }),
    podeVerAvaliacao
      ? comPeriodo(supabase.from('avaliacoes_lotes').select('tipo, total_conversas, nota_media'), 'created_at')
      : Promise.resolve({ data: null, error: null }),
    podeVerTokens
      ? comPeriodo(supabase.from('uso_tokens').select('custo_estimado_usd'), 'created_at')
      : Promise.resolve({ data: null, error: null }),
  ])

  const listas = (listasRes.data ?? []) as { tipo: string; empresas: unknown[] }[]
  const totalEmpresas = listas.reduce((s, l) => s + (Array.isArray(l.empresas) ? l.empresas.length : 0), 0)
  const totalListasBdr = listas.filter(l => l.tipo === 'bdr').length
  const totalListasParcerias = listas.filter(l => l.tipo === 'parcerias').length

  let avaliacao: { atendimentos: { total: number; notaMedia: number }; telefonemas: { total: number; notaMedia: number } } | null = null
  if (podeVerAvaliacao) {
    const lotes = (lotesRes.data ?? []) as { tipo: string; total_conversas: number; nota_media: number | null }[]
    const resumoPorTipo = (tipo: string) => {
      const doTipo = lotes.filter(l => l.tipo === tipo)
      const total = doTipo.reduce((s, l) => s + (l.total_conversas ?? 0), 0)
      const somaNotas = doTipo.reduce((s, l) => s + (l.nota_media ?? 0) * (l.total_conversas ?? 0), 0)
      return { total, notaMedia: total > 0 ? Math.round((somaNotas / total) * 10) / 10 : 0 }
    }
    avaliacao = { atendimentos: resumoPorTipo('atendimento'), telefonemas: resumoPorTipo('telefonema') }
  }

  let tokens: { custoTotalUsd: number } | null = null
  if (podeVerTokens) {
    const linhas = (tokensRes.data ?? []) as { custo_estimado_usd: number | null }[]
    tokens = { custoTotalUsd: linhas.reduce((s, l) => s + (l.custo_estimado_usd ?? 0), 0) }
  }

  return NextResponse.json({
    contratos: { total: contratosRes.count ?? 0 },
    emails: { total: emailsRes.count ?? 0 },
    prospeccao: { totalEmpresas, totalListasBdr, totalListasParcerias },
    cco: podeVerCco ? { totalContatos: ccoRes.count ?? 0 } : null,
    avaliacao,
    tokens,
  })
}
