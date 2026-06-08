import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

type ParceiroSeed = {
  nome: string
  sistema: string | null
  login_usuario: string | null
  senha: string | null
  valor_diaria: string | null
  valor_hora: string | null
  contato_email: string | null
  contato_telefone: string | null
  mesas: string | null
  observacoes: string | null
  status: string
}

const PARCEIROS: ParceiroSeed[] = [
  {
    nome: 'Station We',
    sistema: 'https://admin.stationwe.com.br/login',
    login_usuario: 'reservasparceiros@nex.work',
    senha: 'Nex*mkt*2023@',
    valor_diaria: 'R$ 40,00',
    valor_hora: 'R$ 90,00',
    contato_email: 'contato@stationwe.com.br',
    contato_telefone: '(11) 92002-5088',
    mesas: '3 posições - CPE (DASH 4831); 3 posições - FCO (DASH 4830); 6072',
    observacoes: null,
    status: 'ativo',
  },
  {
    nome: 'Woba',
    sistema: 'https://woba.com.br/signin',
    login_usuario: 'reservasparceiros@nex.work',
    senha: 'Nex*mkt*2023',
    valor_diaria: 'R$ 25,00',
    valor_hora: 'Salas 1–3 pax: R$ 21/h | R$ 128/dia\nSalas 4–6 pax: R$ 52/h | R$ 416/dia\nSalas 7–9 pax: R$ 82/h | R$ 656/dia\nSalas 10–12 pax: R$ 113/h | R$ 904/dia',
    contato_email: 'diego.sousa@woba.com.br',
    contato_telefone: '(11) 98912-8804',
    mesas: '5 posições - CPE (DASH 4829); 8 posições - FCO (DASH 820)',
    observacoes: null,
    status: 'ativo',
  },
  {
    nome: 'Worknmate / Offi',
    sistema: 'https://worknmates.com/host/onboarding | https://www.getoffi.com/',
    login_usuario: 'reservasparceiros@nex.work',
    senha: 'nex*mkt*2023',
    valor_diaria: 'R$ 50,00',
    valor_hora: 'R$ 63,00 — diária: R$ 623,70',
    contato_email: 'vanessa.marcon@worknmates.com',
    contato_telefone: '(49) 98868-4550',
    mesas: '10 posições — dash 3084',
    observacoes: null,
    status: 'ativo',
  },
  {
    nome: 'Jobpass',
    sistema: 'https://console.jobpass.me/entrar',
    login_usuario: 'reservasparceiros@nex.work',
    senha: 'Nex*mkt*2023',
    valor_diaria: 'R$ 40,00',
    valor_hora: 'R$ 65/h até 6 posições | diária R$ 650,00\nR$ 80/h 7 ou mais posições | diária R$ 800,00',
    contato_email: 'claudiovilar@jobpass.com.br',
    contato_telefone: '(31) 97307-2809',
    mesas: '7 posições (dash 2989)',
    observacoes: null,
    status: 'ativo',
  },
  {
    nome: 'OOND',
    sistema: 'https://app.oond.com.br/login',
    login_usuario: 'reservasparceiros@nex.work',
    senha: 'nex*mkt*2023',
    valor_diaria: 'R$ 63,00',
    valor_hora: 'R$ 63,00',
    contato_email: null,
    contato_telefone: '(11) 93083-5448 / 11 97407-5916 (novo)',
    mesas: '5 posições (DASH 3085)',
    observacoes: 'AUD: R$ 1.200,00',
    status: 'ativo',
  },
  {
    nome: 'Pluria',
    sistema: 'https://spaces.pluria.co/login',
    login_usuario: 'reservasparceiros@nex.work',
    senha: 'N3x2023!',
    valor_diaria: 'Sala de reunião: R$ 720,00 | Auditório: R$ 1.576,00',
    valor_hora: 'R$ 64,00',
    contato_email: 'mircea@pluria.co | david@pluria.co | juan.bolivar@pluria.co',
    contato_telefone: '40725647232',
    mesas: null,
    observacoes: 'Perfil Conexa: 5651',
    status: 'ativo',
  },
  {
    nome: 'Desana',
    sistema: 'http://operator.desana.io/login',
    login_usuario: 'reservasparceiros@nex.work',
    senha: 'CÓDIGO ENVIADO NO E-MAIL',
    valor_diaria: 'R$ 99,00 — Mesa | R$ 243,00 — Escritório 2 pax',
    valor_hora: 'R$ 85,50 — R3 | R$ 108,00',
    contato_email: 'operators@desana.io (Fabiana)',
    contato_telefone: null,
    mesas: null,
    observacoes: 'Regra: Valor de Tabela com desconto de 10%\nPerfil Conexa: 5650',
    status: 'ativo',
  },
]

export async function POST(req: NextRequest) {
  const bearerToken = req.headers.get('authorization')?.replace('Bearer ', '')
  const seedSecret = process.env.SEED_SECRET

  if (seedSecret && bearerToken === seedSecret) {
    // authorized via SEED_SECRET
  } else {
    const session = await getServerSession(authOptions)
    if (!session || session.user.perfil !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
  }

  const supabase = createServerClient()
  const results = []

  for (const p of PARCEIROS) {
    const { error } = await supabase
      .from('parceiros')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(p as any, { onConflict: 'nome' })

    results.push({ nome: p.nome, status: error ? 'error' : 'ok', detail: error?.message })
  }

  return NextResponse.json({ total: PARCEIROS.length, results })
}
