import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { sendEmailViaGmail } from '@/lib/gmail'

export const dynamic = 'force-dynamic'

const DESTINATARIOS: Record<string, string[]> = {
  francisco_rocha: ['felipe@nex.work', 'lenise@nex.work', 'edmilson@nex.work', 'virginia@nex.work', 'marialuiza@nex.work'],
  nex_house:       ['felipe@nex.work', 'lenise@nex.work', 'altieres@nex.work', 'lorena@nex.work'],
}

const UNIDADE_LABEL: Record<string, string> = {
  francisco_rocha: 'Francisco Rocha (FCO)',
  nex_house:       'Nex House (NH)',
}

const TIPO_LABEL: Record<string, string> = {
  primeira_vez: 'Reunião — Primeira vez',
  quatro_horas: 'Reunião — 4 horas ou mais',
}

function buildEmailHtml(dados: {
  tipo: string
  nome_cliente: string
  data: string
  horario: string
  nome_sala: string
  quantidade_pessoas: number | null
  observacoes: string | null
  unidade: string
  operador: string
}): { assunto: string; corpo: string } {
  const dataFormatada = new Date(dados.data + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })
  const tipoLabel = TIPO_LABEL[dados.tipo] ?? dados.tipo
  const unidadeLabel = UNIDADE_LABEL[dados.unidade] ?? dados.unidade

  const assunto = `[${tipoLabel}] ${dados.nome_cliente} — ${dataFormatada}, ${dados.horario} · ${unidadeLabel}`

  const intro = dados.tipo === 'primeira_vez'
    ? 'Uma nova reserva de sala foi registrada para um cliente <strong>de primeira vez</strong>. Fique de olho para garantir uma ótima experiência!'
    : 'Uma nova reserva de sala foi registrada para uma sessão de <strong>4 horas ou mais</strong>. Atenção especial ao acolhimento!'

  const corpo = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
        <tr>
          <td style="background:#0a0a0a;padding:24px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.5px;">Nex.</span>
            <span style="color:#888;font-size:12px;margin-left:12px;">Registro de Reservas</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 24px;">
            <p style="margin:0 0 16px;font-size:14px;color:#555;line-height:1.6;">${intro}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
              <tr style="background:#f9f9f9;">
                <td style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#888;width:40%;">Tipo</td>
                <td style="padding:10px 16px;font-size:14px;color:#0a0a0a;font-weight:600;">${tipoLabel}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#888;border-top:1px solid #f0f0f0;">Cliente</td>
                <td style="padding:10px 16px;font-size:14px;color:#0a0a0a;border-top:1px solid #f0f0f0;">${dados.nome_cliente}</td>
              </tr>
              <tr style="background:#f9f9f9;">
                <td style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#888;border-top:1px solid #f0f0f0;">Data</td>
                <td style="padding:10px 16px;font-size:14px;color:#0a0a0a;border-top:1px solid #f0f0f0;text-transform:capitalize;">${dataFormatada}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#888;border-top:1px solid #f0f0f0;">Horário</td>
                <td style="padding:10px 16px;font-size:14px;color:#0a0a0a;border-top:1px solid #f0f0f0;">${dados.horario}</td>
              </tr>
              <tr style="background:#f9f9f9;">
                <td style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#888;border-top:1px solid #f0f0f0;">Sala</td>
                <td style="padding:10px 16px;font-size:14px;color:#0a0a0a;border-top:1px solid #f0f0f0;">${dados.nome_sala}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#888;border-top:1px solid #f0f0f0;">Pessoas</td>
                <td style="padding:10px 16px;font-size:14px;color:#0a0a0a;border-top:1px solid #f0f0f0;">${dados.quantidade_pessoas ?? '—'}</td>
              </tr>
              <tr style="background:#f9f9f9;">
                <td style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#888;border-top:1px solid #f0f0f0;">Unidade</td>
                <td style="padding:10px 16px;font-size:14px;color:#0a0a0a;border-top:1px solid #f0f0f0;">${unidadeLabel}</td>
              </tr>
              ${dados.observacoes ? `
              <tr>
                <td style="padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#888;border-top:1px solid #f0f0f0;">Observações</td>
                <td style="padding:10px 16px;font-size:14px;color:#0a0a0a;border-top:1px solid #f0f0f0;">${dados.observacoes}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px;">
            <p style="margin:0;font-size:12px;color:#aaa;">Registrado por ${dados.operador} via Nex Operações.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { assunto, corpo }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!session.accessToken) return NextResponse.json({ error: 'Token Gmail não disponível. Faça login novamente.' }, { status: 401 })

  const body = await req.json()
  const { tipo, nome_cliente, data, horario, nome_sala, quantidade_pessoas, observacoes, unidade } = body

  if (!tipo || !nome_cliente || !data || !horario || !nome_sala || !unidade) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: registro, error } = await supabase.from('registro_reservas').insert({
    tipo, nome_cliente, data, horario, nome_sala,
    quantidade_pessoas: quantidade_pessoas || null,
    observacoes: observacoes || null,
    unidade,
    operador_email: session.user.email,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const destinatarios = DESTINATARIOS[unidade] ?? []
  const { assunto, corpo } = buildEmailHtml({
    tipo, nome_cliente, data, horario, nome_sala,
    quantidade_pessoas: quantidade_pessoas || null,
    observacoes: observacoes || null,
    unidade,
    operador: session.user.nome ?? session.user.name ?? session.user.email ?? '',
  })

  if (destinatarios.length > 0) {
    const [to, ...cc] = destinatarios
    await sendEmailViaGmail({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      to,
      cc,
      subject: assunto,
      body: corpo,
      senderName: session.user.nome ?? session.user.name ?? undefined,
    })
  }

  return NextResponse.json({ success: true, registro })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const de = searchParams.get('de')
  const ate = searchParams.get('ate')
  const unidade = searchParams.get('unidade')
  const tipo = searchParams.get('tipo')

  const supabase = createServerClient()
  let query = supabase.from('registro_reservas').select('*').order('data', { ascending: false }).order('horario', { ascending: false })

  if (de) query = query.gte('data', de)
  if (ate) query = query.lte('data', ate)
  if (unidade) query = query.eq('unidade', unidade)
  if (tipo) query = query.eq('tipo', tipo)

  const { data, error } = await query.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ registros: data ?? [] })
}
