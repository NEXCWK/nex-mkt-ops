import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const TEMPLATES = [
  { tipo: 'escritorio_privativo_nex_house',       nome: 'Escritório Privativo — Nex House',            arquivo: 'escritorio_privativo_nex_house.docx' },
  { tipo: 'escritorio_privativo_francisco_rocha', nome: 'Escritório Privativo — Francisco Rocha',       arquivo: 'escritorio_privativo_francisco_rocha.docx' },
  { tipo: 'nex_house_atrium',                     nome: 'Nex House — Atrium',                          arquivo: 'nex_house_atrium.docx' },
  { tipo: 'nex_house_gallery',                    nome: 'Nex House — Gallery',                         arquivo: 'nex_house_gallery.docx' },
  { tipo: 'nex_house_atrium_anual',               nome: 'Nex House — Assinatura Atrium Anual',          arquivo: 'nex_house_atrium_anual.docx' },
  { tipo: 'nex_house_gallery_anual',              nome: 'Nex House — Assinatura Gallery Anual',         arquivo: 'nex_house_gallery_anual.docx' },
  { tipo: 'termo_eventos',                        nome: 'Termo Compromisso — Eventos (Externo)',        arquivo: 'termo_eventos.docx' },
  { tipo: 'termo_eventos_residentes',             nome: 'Termo Compromisso — Eventos (Residentes)',     arquivo: 'termo_eventos_residentes.docx' },
  { tipo: 'termo_diaria_reuniao',                 nome: 'Termo Compromisso — Diária e Reunião',         arquivo: 'termo_diaria_reuniao.docx' },
  { tipo: 'escritorio_virtual_fiscal',            nome: 'Escritório Virtual — Endereço Fiscal',         arquivo: 'escritorio_virtual_fiscal.docx' },
  { tipo: 'escritorio_virtual_fiscal_oab',        nome: 'Escritório Virtual — Endereço Fiscal OAB',     arquivo: 'escritorio_virtual_fiscal_oab.docx' },
  { tipo: 'escritorio_virtual_comercial',         nome: 'Escritório Virtual — Endereço Comercial',      arquivo: 'escritorio_virtual_comercial.docx' },
  { tipo: 'escritorio_virtual_comercial_oab',     nome: 'Escritório Virtual — Endereço Comercial OAB',  arquivo: 'escritorio_virtual_comercial_oab.docx' },
  { tipo: 'aditivo_ev_pf_para_pj',               nome: 'Aditivo EV — Troca de Polo PF → PJ',           arquivo: 'aditivo_ev_pf_para_pj.docx' },
  { tipo: 'aditivo_ev_pj_para_pj',               nome: 'Aditivo EV — Troca de Polo PJ → PJ',           arquivo: 'aditivo_ev_pj_para_pj.docx' },
]

export async function POST(req: NextRequest) {
  const bearerToken = req.headers.get('authorization')?.replace('Bearer ', '')
  const seedSecret = process.env.SEED_SECRET

  if (seedSecret && bearerToken === seedSecret) {
    // authorized via SEED_SECRET env var
  } else {
    const session = await getServerSession(authOptions)
    if (!session || session.user.perfil !== 'admin') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
  }

  const supabase = createServerClient()
  const results: { tipo: string; status: string; detail?: string }[] = []
  const sourceDir = resolve(process.cwd(), '_template-source')

  for (const t of TEMPLATES) {
    const filePath = resolve(sourceDir, t.arquivo)

    if (!existsSync(filePath)) {
      results.push({ tipo: t.tipo, status: 'skipped', detail: 'arquivo não encontrado' })
      continue
    }

    const fileBuffer = readFileSync(filePath)
    const storagePath = `contratos/${t.arquivo}`

    const { error: uploadError } = await supabase.storage
      .from('templates')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      })

    if (uploadError) {
      results.push({ tipo: t.tipo, status: 'error', detail: uploadError.message })
      continue
    }

    const { error: dbError } = await supabase
      .from('templates_documentos')
      .upsert({ tipo: t.tipo, nome: t.nome, arquivo_url: storagePath, versao: 1 }, { onConflict: 'tipo' })

    results.push({
      tipo: t.tipo,
      status: dbError ? 'db_error' : 'ok',
      detail: dbError?.message,
    })
  }

  const ok = results.filter(r => r.status === 'ok').length
  const errors = results.filter(r => r.status !== 'ok' && r.status !== 'skipped')

  return NextResponse.json({ ok, total: TEMPLATES.length, results })
}
