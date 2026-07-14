import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enviarLote, type Destinatario } from '@/lib/bulk-email'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!session.accessToken) {
    return NextResponse.json({ error: 'Token Gmail não disponível. Faça login com a conta comercial novamente.' }, { status: 401 })
  }

  const { tipo, assunto, corpo, destinatarios } = await req.json()
  if (!assunto || !corpo || !Array.isArray(destinatarios) || destinatarios.length === 0) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  const senderName = tipo === 'parcerias'
    ? 'Nex Coworking <bruna@nex.work>'
    : 'Nex Coworking <comercial@nex.work>'

  try {
    const resultado = await enviarLote({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      destinatarios: destinatarios as Destinatario[],
      assunto,
      corpo,
      senderName,
    })
    return NextResponse.json(resultado)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha no envio' }, { status: 500 })
  }
}
