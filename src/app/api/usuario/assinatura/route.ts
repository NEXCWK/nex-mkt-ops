import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

  const allowed = ['image/png', 'image/jpeg', 'image/webp']
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Apenas PNG, JPG ou WebP são aceitos' }, { status: 400 })
  }

  const supabase = createServerClient()
  const email = session.user.email!
  const ext = file.type.split('/')[1]
  const path = `${email}/assinatura.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('assinaturas')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: urlData } = supabase.storage.from('assinaturas').getPublicUrl(path)
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

  const { error: dbError } = await supabase
    .from('usuarios')
    .update({ assinatura_url: urlData.publicUrl })
    .eq('email', email)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ url: publicUrl })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = createServerClient()
  const email = session.user.email!

  await supabase.storage.from('assinaturas').remove([
    `${email}/assinatura.png`,
    `${email}/assinatura.jpeg`,
    `${email}/assinatura.webp`,
  ])

  await supabase.from('usuarios').update({ assinatura_url: null }).eq('email', email)

  return NextResponse.json({ ok: true })
}
