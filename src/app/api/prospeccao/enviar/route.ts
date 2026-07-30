import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enviarLote, type Destinatario } from '@/lib/bulk-email'
import { remetenteValido, senderNameParaRemetente, REMETENTES_DISPARO } from '@/lib/remetentes'
import { buscarAssinaturaDisparo } from '@/lib/disparo-assinatura'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!session.accessToken) {
    return NextResponse.json({ error: 'Token Gmail não disponível. Faça login com a conta comercial novamente.' }, { status: 401 })
  }

  const { assunto, corpo, destinatarios, remetente } = await req.json()
  if (!assunto || !corpo || !Array.isArray(destinatarios) || destinatarios.length === 0) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  const remetenteEscolhido = remetente || REMETENTES_DISPARO[0].email
  if (!remetenteValido(remetenteEscolhido)) {
    return NextResponse.json({ error: 'Remetente inválido' }, { status: 400 })
  }

  const senderName = senderNameParaRemetente(remetenteEscolhido)

  try {
    const assinaturaUrl = await buscarAssinaturaDisparo(remetenteEscolhido)
    const resultado = await enviarLote({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      destinatarios: destinatarios as Destinatario[],
      assunto,
      corpo,
      senderName,
      assinaturaUrl,
    })
    return NextResponse.json(resultado)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha no envio' }, { status: 500 })
  }
}
