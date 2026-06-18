import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { sendEmailViaGmail } from '@/lib/gmail'
import { COPIAS_FIXAS, COPIAS_POR_UNIDADE, type Unidade } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!session.accessToken) return NextResponse.json({ error: 'Token Gmail não disponível. Faça login novamente.' }, { status: 401 })

    const { modelo, unidade, campos, destinatario, assunto, corpo, threadId } = await req.json()

    // Monta cópias garantindo as fixas + por unidade
    const copiasFinais: string[] = [...COPIAS_FIXAS]
    if (unidade && COPIAS_POR_UNIDADE[unidade as Unidade]) {
      copiasFinais.push(COPIAS_POR_UNIDADE[unidade as Unidade])
    }
    // Remove duplicatas
    const copiasUnicas = Array.from(new Set(copiasFinais))

    await sendEmailViaGmail({
      accessToken: session.accessToken,
      to: destinatario,
      cc: copiasUnicas,
      subject: assunto,
      body: corpo,
      senderName: session.user.nome ?? session.user.name ?? undefined,
      threadId: threadId ?? undefined,
    })

    const supabase = createServerClient()

    // Busca ou cria cliente
    let clienteId: string | null = null
    if (campos?.nome_cliente) {
      let { data: cliente } = await supabase.from('clientes').select('id').eq('nome', campos.nome_cliente).maybeSingle()
      if (!cliente) {
        const { data: novo } = await supabase.from('clientes').insert({ nome: campos.nome_cliente }).select('id').single()
        cliente = novo
      }
      clienteId = cliente?.id ?? null
    }

    // Busca template (opcional)
    const { data: template } = await supabase
      .from('templates_email')
      .select('id')
      .eq('tipo', modelo)
      .order('versao', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Registra no log (imutável)
    await supabase.from('emails_enviados').insert({
      template_id: template?.id ?? null,
      cliente_id: clienteId,
      destinatario,
      copia_json: copiasUnicas,
      corpo_final: corpo,
      operador_email: session.user.email,
      unidade: unidade || null,
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message ?? 'Erro ao enviar e-mail' }, { status: 500 })
  }
}
