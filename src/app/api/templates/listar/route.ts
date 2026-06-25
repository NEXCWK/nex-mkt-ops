import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// Lista todos os templates de documento cadastrados (com arquivo no Storage),
// para edição direta via IA na aba Gerador de Templates.
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['gestor', 'admin'].includes(session.user.perfil ?? '')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('templates_documentos')
    .select('tipo, nome, versao, arquivo_url, campos_json')
    .not('arquivo_url', 'is', null)
    .order('nome')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mantém a versão mais recente por tipo, expondo os nomes dos campos (tokens)
  type Item = { tipo: string; nome: string; versao: number; campos: string[] }
  const porTipo = new Map<string, Item>()
  for (const t of data ?? []) {
    const campos = Array.isArray(t.campos_json)
      ? (t.campos_json as Array<{ nome?: string }>).map(c => String(c?.nome ?? '')).filter(Boolean)
      : []
    const atual = porTipo.get(t.tipo)
    if (!atual || (t.versao ?? 0) > atual.versao) {
      porTipo.set(t.tipo, { tipo: t.tipo, nome: t.nome, versao: t.versao ?? 1, campos })
    }
  }

  return NextResponse.json({ templates: [...porTipo.values()] })
}
