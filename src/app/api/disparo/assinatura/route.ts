import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { remetenteValido } from '@/lib/remetentes'

export const dynamic = 'force-dynamic'

/** Assinatura (imagem) cadastrada para um remetente de disparo — usada como rodapé nos e-mails em massa. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const remetente = req.nextUrl.searchParams.get('remetente') ?? ''
  if (!remetenteValido(remetente)) return NextResponse.json({ error: 'Remetente inválido' }, { status: 400 })

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('disparo_assinaturas')
    .select('url, updated_at')
    .eq('remetente', remetente)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data?.url ?? null })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const formData = await req.formData()
  const remetente = String(formData.get('remetente') ?? '')
  const file = formData.get('file') as File | null

  if (!remetenteValido(remetente)) return NextResponse.json({ error: 'Remetente inválido' }, { status: 400 })
  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
  if (file.type !== 'image/png') return NextResponse.json({ error: 'Apenas arquivos .png são aceitos' }, { status: 400 })

  const supabase = createServerClient()
  const path = `disparo/${encodeURIComponent(remetente)}.png`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('assinaturas')
    .upload(path, buffer, { contentType: 'image/png', upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from('assinaturas').getPublicUrl(path)
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

  const { error: dbError } = await supabase
    .from('disparo_assinaturas')
    .upsert({ remetente, url: urlData.publicUrl, atualizado_por: session.user.email, updated_at: new Date().toISOString() })

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ url: publicUrl })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const remetente = req.nextUrl.searchParams.get('remetente') ?? ''
  if (!remetenteValido(remetente)) return NextResponse.json({ error: 'Remetente inválido' }, { status: 400 })

  const supabase = createServerClient()
  await supabase.storage.from('assinaturas').remove([`disparo/${encodeURIComponent(remetente)}.png`])
  await supabase.from('disparo_assinaturas').delete().eq('remetente', remetente)

  return NextResponse.json({ ok: true })
}
