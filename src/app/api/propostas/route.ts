import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { uploadDocumentToDrive } from '@/lib/drive'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { tipo, unidade, campos } = await req.json()

    const supabase = createServerClient()
    const { data: template } = await supabase
      .from('templates_documentos')
      .select('*')
      .eq('tipo', `proposta_${tipo}`)
      .eq('unidade', unidade)
      .order('versao', { ascending: false })
      .limit(1)
      .maybeSingle()

    let driveUrl: string | null = null
    let pptxBase64: string

    if (template?.arquivo_url) {
      const { data: fileData } = await supabase.storage.from('templates').download(template.arquivo_url)
      if (!fileData) throw new Error('Template não encontrado')
      const buf = Buffer.from(await fileData.arrayBuffer())

      if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON && campos.nome_cliente) {
        try {
          const result = await uploadDocumentToDrive(buf, `proposta_${tipo}_${Date.now()}.pptx`,
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            campos.nome_cliente, 'Propostas')
          driveUrl = result.driveUrl
        } catch (e) { console.error(e) }
      }

      pptxBase64 = buf.toString('base64')
    } else {
      // Placeholder
      const placeholder = Buffer.from(`Proposta: ${tipo} - ${unidade}\n\n${Object.entries(campos).map(([k, v]) => `${k}: ${v}`).join('\n')}`)
      pptxBase64 = placeholder.toString('base64')
    }

    const pptxUrl = `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${pptxBase64}`

    return NextResponse.json({ pptxUrl, driveUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
