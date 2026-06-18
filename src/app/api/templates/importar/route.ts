import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['gestor', 'admin'].includes(session.user.perfil ?? '')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { nome, tipo, docxBase64, campos_json } = await req.json()

  if (!nome || !tipo || !docxBase64) {
    return NextResponse.json({ error: 'Campos obrigatórios: nome, tipo, docxBase64' }, { status: 400 })
  }

  if (!/^[a-z0-9_]+$/.test(tipo)) {
    return NextResponse.json(
      { error: 'O tipo deve ser snake_case (apenas letras minúsculas, números e underscore)' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()
  const arquivoPath = `contratos/${tipo}.docx`
  const fileBuffer = Buffer.from(docxBase64, 'base64')

  const { error: uploadError } = await supabase.storage
    .from('templates')
    .upload(arquivoPath, fileBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: `Erro no upload: ${uploadError.message}` }, { status: 500 })
  }

  const { error: dbError } = await supabase
    .from('templates_documentos')
    .upsert(
      {
        tipo,
        nome,
        arquivo_url: arquivoPath,
        campos_json: campos_json ?? [],
        versao: 1,
        criado_por: session.user.email,
      },
      { onConflict: 'tipo' }
    )

  if (dbError) {
    return NextResponse.json({ error: `Erro ao registrar: ${dbError.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, tipo, arquivo: arquivoPath })
}
