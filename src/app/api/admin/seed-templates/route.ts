import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { lerExcluidos, desmarcarExcluido } from '@/lib/templates-blocklist'
import { TEMPLATES_SISTEMA } from '@/lib/templates-sistema'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const TEMPLATES = TEMPLATES_SISTEMA

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

  // ?force=true reimporta todos; padrão importa só os que ainda não existem
  const force = req.nextUrl.searchParams.get('force') === 'true'

  // ?tipos=a,b,c reimporta SOMENTE os tipos informados (independente de já
  // estarem importados ou excluídos) — usado pelo botão "Reimportar" por
  // linha/seleção na aba Templates, sem afetar os demais.
  const tiposParam = req.nextUrl.searchParams.get('tipos')
  const tiposSelecionados = tiposParam ? new Set(tiposParam.split(',').map(t => t.trim()).filter(Boolean)) : null

  const supabase = createServerClient()
  const results: { tipo: string; status: string; detail?: string }[] = []
  const sourceDir = resolve(process.cwd(), '_template-source')

  // tipos já registrados no banco (para pular os já importados)
  const { data: existentes } = await supabase
    .from('templates_documentos')
    .select('tipo, arquivo_url')
  const jaImportados = new Map(
    (existentes ?? []).map((e: { tipo: string; arquivo_url: string | null }) => [e.tipo, e.arquivo_url])
  )

  // tipos excluídos manualmente → NÃO reimportar (a menos que force)
  const excluidos = new Set(await lerExcluidos(supabase))

  for (const t of TEMPLATES) {
    // ?tipos=... restringe a reimportação a uma seleção específica — os demais nem entram no loop.
    if (tiposSelecionados && !tiposSelecionados.has(t.tipo)) continue

    const filePath = resolve(sourceDir, t.arquivo)

    if (!existsSync(filePath)) {
      results.push({ tipo: t.tipo, status: 'skipped', detail: 'arquivo não encontrado' })
      continue
    }

    // seleção explícita de tipos → sempre força, igual a "force" (é uma reimportação deliberada)
    const forcarEste = force || tiposSelecionados !== null

    // excluído manualmente → não reimporta (use "Reimportar Todos" ou selecione o tipo para forçar)
    if (!forcarEste && excluidos.has(t.tipo)) {
      results.push({ tipo: t.tipo, status: 'skipped', detail: 'excluído manualmente' })
      continue
    }

    // já importado e com arquivo registrado → pula (a menos que force)
    if (!forcarEste && jaImportados.has(t.tipo) && jaImportados.get(t.tipo)) {
      results.push({ tipo: t.tipo, status: 'skipped', detail: 'já importado' })
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
      .upsert(
        { tipo: t.tipo, nome: t.nome, arquivo_url: storagePath, versao: 1, reimportado_em: new Date().toISOString() },
        { onConflict: 'tipo' }
      )

    // Reimportado com sucesso (ex: via "Reimportar Todos") → remove da blocklist
    if (!dbError && excluidos.has(t.tipo)) await desmarcarExcluido(supabase, t.tipo)

    results.push({
      tipo: t.tipo,
      status: dbError ? 'db_error' : 'ok',
      detail: dbError?.message,
    })
  }

  const totalConsiderado = tiposSelecionados ? tiposSelecionados.size : TEMPLATES.length
  const ok = results.filter(r => r.status === 'ok').length
  const skipped = results.filter(r => r.status === 'skipped').length

  return NextResponse.json({ ok, skipped, total: totalConsiderado, results })
}
