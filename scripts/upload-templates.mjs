/**
 * Script de upload dos templates .docx para o Supabase Storage
 * e registro na tabela templates_documentos.
 *
 * Uso:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/upload-templates.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const UPLOAD_DIR = resolve(__dirname, '../_template-source')

const TEMPLATES = [
  { tipo: 'escritorio_privativo_nex_house',       nome: 'Escritório Privativo — Nex House',             arquivo: 'escritorio_privativo_nex_house.docx' },
  { tipo: 'escritorio_privativo_francisco_rocha',  nome: 'Escritório Privativo — Francisco Rocha',        arquivo: 'escritorio_privativo_francisco_rocha.docx' },
  { tipo: 'nex_house_atrium',                      nome: 'Nex House — Atrium',                           arquivo: 'nex_house_atrium.docx' },
  { tipo: 'nex_house_gallery',                     nome: 'Nex House — Gallery',                          arquivo: 'nex_house_gallery.docx' },
  { tipo: 'termo_eventos',                         nome: 'Termo Compromisso — Eventos (Externo)',         arquivo: 'termo_eventos.docx' },
  { tipo: 'termo_eventos_residentes',              nome: 'Termo Compromisso — Eventos (Residentes)',      arquivo: 'termo_eventos_residentes.docx' },
  { tipo: 'termo_diaria_reuniao',                  nome: 'Termo Compromisso — Diária e Reunião',          arquivo: 'termo_diaria_reuniao.docx' },
  { tipo: 'escritorio_virtual_fiscal',             nome: 'Escritório Virtual — Endereço Fiscal',          arquivo: 'escritorio_virtual_fiscal.docx' },
  { tipo: 'escritorio_virtual_fiscal_oab',         nome: 'Escritório Virtual — Endereço Fiscal OAB',      arquivo: 'escritorio_virtual_fiscal_oab.docx' },
  { tipo: 'escritorio_virtual_comercial',          nome: 'Escritório Virtual — Endereço Comercial',       arquivo: 'escritorio_virtual_comercial.docx' },
  { tipo: 'escritorio_virtual_comercial_oab',      nome: 'Escritório Virtual — Endereço Comercial OAB',   arquivo: 'escritorio_virtual_comercial_oab.docx' },
  { tipo: 'aditivo_ev_pf_para_pj',                 nome: 'Aditivo EV — Troca de Polo PF → PJ',            arquivo: 'aditivo_ev_pf_para_pj.docx' },
  { tipo: 'aditivo_ev_pj_para_pj',                 nome: 'Aditivo EV — Troca de Polo PJ → PJ',            arquivo: 'aditivo_ev_pj_para_pj.docx' },
]

async function run() {
  console.log('📤  Verificando bucket...')
  // Garante que o bucket existe
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some(b => b.name === 'templates')
  if (!exists) {
    const { error } = await supabase.storage.createBucket('templates', { public: false })
    if (error) console.warn('⚠️  Bucket já existe ou erro:', error.message)
    else console.log('✅  Bucket criado')
  } else {
    console.log('✅  Bucket já existe')
  }
  console.log('\n📤  Iniciando upload de templates...\n')

  for (const t of TEMPLATES) {
    const filePath = resolve(UPLOAD_DIR, t.arquivo)
    let fileBuffer

    try {
      fileBuffer = readFileSync(filePath)
    } catch {
      console.warn(`⚠️   Arquivo não encontrado: ${t.arquivo} — pulando`)
      continue
    }

    const storagePath = `contratos/${t.arquivo}`

    // Upload para Storage
    const { error: uploadError } = await supabase.storage
      .from('templates')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      })

    if (uploadError) {
      console.error(`❌  Erro no upload de ${t.arquivo}:`, uploadError.message)
      continue
    }

    // Registra na tabela templates_documentos
    const { error: dbError } = await supabase
      .from('templates_documentos')
      .upsert(
        { tipo: t.tipo, nome: t.nome, arquivo_url: storagePath, versao: 1 },
        { onConflict: 'tipo' }
      )

    if (dbError) {
      console.error(`❌  Erro ao registrar ${t.tipo} no banco:`, dbError.message)
    } else {
      console.log(`✅  ${t.nome}`)
    }
  }

  console.log('\n✅  Upload concluído.')
}

run()
