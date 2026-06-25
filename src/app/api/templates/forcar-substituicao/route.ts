import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import PizZip from 'pizzip'
import { substituirTodas } from '@/lib/docx-replace'

export const maxDuration = 120

type Sub = { original: string; token: string }

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['gestor', 'admin'].includes(session.user.perfil ?? '')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { docxBase64, substituicoes } = await req.json()
  if (!docxBase64 || !Array.isArray(substituicoes) || substituicoes.length === 0) {
    return NextResponse.json({ error: 'Envie docxBase64 e ao menos uma substituição.' }, { status: 400 })
  }

  let zip: PizZip
  try {
    zip = new PizZip(Buffer.from(docxBase64, 'base64'))
  } catch {
    return NextResponse.json({ error: 'docxBase64 inválido.' }, { status: 422 })
  }
  let xml = zip.file('word/document.xml')?.asText()
  if (!xml) return NextResponse.json({ error: 'document.xml não encontrado.' }, { status: 422 })

  const aplicadas: string[] = []
  const naoAplicadas: Sub[] = []

  for (const sub of substituicoes as Sub[]) {
    if (!sub?.original || !sub?.token) continue
    const tokenStr = `{{${sub.token.replace(/[{}]/g, '')}}}`
    const r = substituirTodas(xml, sub.original, tokenStr)
    xml = r.xml
    if (r.count > 0) aplicadas.push(sub.token)
    else naoAplicadas.push(sub)
  }

  zip.file('word/document.xml', xml)
  const docBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })

  return NextResponse.json({
    docxBase64: docBuffer.toString('base64'),
    aplicadas,
    naoAplicadas,
  })
}
