import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// Baixa o arquivo .docx de um template salvo no Storage.
// GET /api/templates/baixar?tipo=<tipo>
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['gestor', 'admin'].includes(session.user.perfil ?? '')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const tipo = req.nextUrl.searchParams.get('tipo')
  if (!tipo) return NextResponse.json({ error: 'Informe o tipo do template' }, { status: 400 })

  const supabase = createServerClient()

  // Versão mais recente do tipo
  const { data: template, error } = await supabase
    .from('templates_documentos')
    .select('nome, arquivo_url, versao')
    .eq('tipo', tipo)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!template?.arquivo_url) {
    return NextResponse.json({ error: 'Template não encontrado ou sem arquivo' }, { status: 404 })
  }

  const { data: file, error: dlError } = await supabase.storage
    .from('templates')
    .download(template.arquivo_url)

  if (dlError || !file) {
    return NextResponse.json({ error: `Erro ao baixar: ${dlError?.message ?? 'arquivo indisponível'}` }, { status: 500 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  // Nome amigável para o arquivo baixado
  const baseNome = (template.nome || tipo)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase()
  const fileName = `${baseNome || tipo}_v${template.versao ?? 1}.docx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(buffer.length),
    },
  })
}
