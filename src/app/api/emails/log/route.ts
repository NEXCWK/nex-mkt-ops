import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

const UNIDADE_MAP: Record<string, string> = {
  'Unidade Francisco Rocha': 'francisco_rocha',
  'Nex House': 'nex_house',
}

// Registra no log quando o operador copia um e-mail gerado.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { templateTitulo, assunto, corpo, nomeCliente, unidade } = await req.json()
    if (!corpo) return NextResponse.json({ error: 'Corpo vazio' }, { status: 400 })

    const supabase = createServerClient()

    let clienteId: string | null = null
    if (nomeCliente) {
      let { data: cliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome', nomeCliente)
        .maybeSingle()
      if (!cliente) {
        const { data: novo } = await supabase
          .from('clientes')
          .insert({ nome: nomeCliente })
          .select('id')
          .single()
        cliente = novo
      }
      clienteId = cliente?.id ?? null
    }

    const corpoFinal = [
      templateTitulo ? `Template: ${templateTitulo}` : null,
      assunto ? `Assunto: ${assunto}` : null,
      '',
      corpo,
    ].filter(v => v !== null).join('\n')

    const { error } = await supabase.from('emails_enviados').insert({
      cliente_id: clienteId,
      destinatario: nomeCliente || '(não informado)',
      copia_json: [],
      corpo_final: corpoFinal,
      operador_email: session.user.email,
      unidade: UNIDADE_MAP[unidade] ?? null,
    })

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('email log failed:', e)
    return NextResponse.json({ error: e.message ?? 'Erro ao registrar' }, { status: 500 })
  }
}
