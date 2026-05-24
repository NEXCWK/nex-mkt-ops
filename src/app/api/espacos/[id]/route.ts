import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { churn_sinalizado, churn_data } = await req.json()

    if (churn_sinalizado && churn_data) {
      const hoje = new Date().toISOString().split('T')[0]
      if (churn_data < hoje) {
        return NextResponse.json(
          { error: 'A data de disponibilidade deve ser igual ou posterior à data atual.' },
          { status: 400 }
        )
      }
    }

    const supabase = createServerClient()
    const { error } = await supabase
      .from('espacos')
      .update({ churn_sinalizado, churn_data: churn_sinalizado ? churn_data : null })
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
