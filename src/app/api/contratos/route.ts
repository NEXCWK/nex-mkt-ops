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

    const { tipo, campos } = await req.json()
    if (!tipo || !campos) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

    const supabase = createServerClient()

    // Busca template ativo para o tipo
    const { data: template } = await supabase
      .from('templates_documentos')
      .select('*')
      .eq('tipo', tipo)
      .order('versao', { ascending: false })
      .limit(1)
      .single()

    let docBuffer: Buffer
    let driveUrl: string | null = null

    if (template?.arquivo_url) {
      // Baixa o template do Supabase Storage e substitui marcadores
      const { data: fileData } = await supabase.storage
        .from('templates')
        .download(template.arquivo_url)
      if (!fileData) throw new Error('Template não encontrado no storage')
      const arrayBuf = await fileData.arrayBuffer()
      docBuffer = await generateDocx(Buffer.from(arrayBuf), campos)
    } else {
      // Gera um docx mínimo de placeholder se não houver template configurado
      docBuffer = Buffer.from(`Documento: ${tipo}\n\n${Object.entries(campos).map(([k, v]) => `${k}: ${v}`).join('\n')}`)
    }

    // Salva ou busca cliente
    let clienteId: string | null = null
    if (campos.nome_cliente) {
      let { data: cliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome', campos.nome_cliente)
        .maybeSingle()

      if (!cliente) {
        const { data: novoCliente } = await supabase
          .from('clientes')
          .insert({ nome: campos.nome_cliente, email: campos.email_cliente })
          .select('id')
          .single()
        cliente = novoCliente
      }
      clienteId = cliente?.id ?? null
    }

    // Upload ao Drive em background
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON && campos.nome_cliente) {
      try {
        const result = await uploadDocumentToDrive(
          docBuffer,
          `${tipo}_${Date.now()}.docx`,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          campos.nome_cliente,
          'Contratos'
        )
        driveUrl = result.driveUrl
      } catch (e) {
        console.error('Drive upload failed:', e)
      }
    }

    // Registra no banco
    const { data: doc } = await supabase
      .from('documentos_gerados')
      .insert({
        cliente_id: clienteId,
        template_id: template?.id ?? null,
        tipo,
        drive_url: driveUrl,
        operador_email: session.user.email,
      })
      .select('id')
      .single()

    // Retorna o buffer como base64 para download no cliente
    const base64 = docBuffer.toString('base64')
    const docUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`

    return NextResponse.json({ docUrl, driveUrl, documentoId: doc?.id })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message ?? 'Erro interno' }, { status: 500 })
  }
}
