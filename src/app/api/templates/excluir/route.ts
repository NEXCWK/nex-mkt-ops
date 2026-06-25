import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['gestor', 'admin'].includes(session.user.perfil ?? '')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { tipo } = await req.json()
  if (!tipo) return NextResponse.json({ error: 'Informe o tipo do template' }, { status: 400 })

  const supabase = createServerClient()

  // Busca todos os registros desse tipo (pode haver versões)
  const { data: regs } = await supabase
    .from('templates_documentos')
    .select('id, arquivo_url')
    .eq('tipo', tipo)

  // Remove os arquivos do Storage
  const paths = (regs ?? []).map(r => r.arquivo_url).filter((p): p is string => !!p)
  if (paths.length > 0) {
    await supabase.storage.from('templates').remove(paths)
  }

  // Remove os registros do banco
  const { error } = await supabase.from('templates_documentos').delete().eq('tipo', tipo)
  if (error) return NextResponse.json({ error: `Erro ao excluir: ${error.message}` }, { status: 500 })

  return NextResponse.json({ ok: true, tipo, removidos: regs?.length ?? 0 })
}
