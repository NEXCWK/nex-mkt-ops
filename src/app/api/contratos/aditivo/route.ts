import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { generateDocx } from '@/lib/docx'
import { uploadDocumentToDrive } from '@/lib/drive'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { tipo, camposContrato, camposAditivo, documentoOrigemId } = await req.json()

    const supabase = createServerClient()
    const { data: template } = await supabase
      .from('templates_documentos')
      .select('*')
      .eq('tipo', tipo)
      .order('versao', { ascending: false })
      .limit(1)
      .maybeSingle()

    const allCampos = { ...camposContrato, ...camposAditivo }
    let docBuffer: Buffer

    if (template?.arquivo_url) {
      const { data: fileData } = await supabase.storage.from('templates').download(template.arquivo_url)
      if (!fileData) throw new Error('Template não encontrado')
      const arrayBuf = await fileData.arrayBuffer()
      docBuffer = await generateDocx(Buffer.from(arrayBuf), allCampos)
    } else {
      docBuffer = Buffer.from(`Aditivo: ${tipo}\n\n${Object.entries(allCampos).map(([k, v]) => `${k}: ${v}`).join('\n')}`)
    }

    let driveUrl: string | null = null
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON && camposContrato.nome_cliente) {
      try {
        const result = await uploadDocumentToDrive(
          docBuffer,
          `aditivo_${tipo}_${Date.now()}.docx`,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          camposContrato.nome_cliente,
          'Contratos'
        )
        driveUrl = result.driveUrl
      } catch (e) {
        console.error('Drive upload failed:', e)
      }
    }

    const base64 = docBuffer.toString('base64')
    const docUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`

    return NextResponse.json({ docUrl, driveUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
