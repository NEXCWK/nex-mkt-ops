import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

// Nunca cachear — um template recém-importado precisa aparecer imediatamente
// na lista de Novo Contrato sem reimportar nada.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Tipos já cobertos pelo código hardcoded em Novo Contrato — não retornar como dinâmicos
const TIPOS_HARDCODED = new Set([
  'escritorio_privativo_nex_house', 'escritorio_privativo_francisco_rocha',
  'nex_house_atrium', 'nex_house_gallery', 'nex_house_atrium_anual', 'nex_house_gallery_anual',
  'termo_eventos', 'termo_eventos_residentes', 'termo_diaria_reuniao',
  'escritorio_virtual_fiscal', 'escritorio_virtual_fiscal_oab',
  'escritorio_virtual_comercial', 'escritorio_virtual_comercial_oab',
  'aditivo_ev_pf_para_pj', 'aditivo_ev_pj_para_pj', 'aditivo_ev_alteracao_endereco',
])

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = createServerClient()
  const { data } = await supabase
    .from('templates_documentos')
    .select('tipo, nome, campos_json')
    .not('campos_json', 'is', null)
    .order('nome')

  const dinamicos = (data ?? []).filter(
    t => !TIPOS_HARDCODED.has(t.tipo) && Array.isArray(t.campos_json) && t.campos_json.length > 0
  )

  return NextResponse.json({ templates: dinamicos })
}
