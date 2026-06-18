import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buscarThreads } from '@/lib/gmail'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!session.accessToken) {
    return NextResponse.json({ error: 'Token Gmail não disponível. Faça login novamente.' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (!q.trim()) return NextResponse.json({ threads: [] })

  try {
    const threads = await buscarThreads({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      query: q,
    })
    return NextResponse.json({ threads })
  } catch (e: any) {
    const msg = e?.message ?? ''
    // Scope insuficiente: usuário precisa re-fazer login para autorizar gmail.readonly
    if (msg.includes('insufficientPermissions') || msg.includes('Insufficient Permission')) {
      return NextResponse.json(
        { error: 'scope_insuficiente', message: 'Faça login novamente para autorizar a busca de threads.' },
        { status: 403 }
      )
    }
    return NextResponse.json({ error: msg || 'Erro ao buscar threads' }, { status: 500 })
  }
}
