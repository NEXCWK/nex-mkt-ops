import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { askHaikuText, assertApiKey } from '@/lib/anthropic'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiErr = assertApiKey()
  if (apiErr) return NextResponse.json({ error: apiErr }, { status: 500 })

  const { markdown } = await req.json()
  if (!markdown) return NextResponse.json({ error: 'Markdown vazio' }, { status: 400 })

  const system = `Você resume a base de conhecimento do Assistente SDR de IA do Nex Coworking em um resumo executivo curto, para o gestor consultar rapidamente.

Regras estritas:
- Português brasileiro, direto e objetivo.
- Estrutura em tópicos curtos, organizados por seção (ex.: Identidade, Tom de voz, Produtos, Preços-chave, Regras de negociação, Quando encaminhar para humano).
- Sem emojis, sem cores, sem markdown de ênfase decorativa (sem negrito/itálico em excesso). Pode usar títulos simples e traços "-" para listas.
- Não repita o documento inteiro: extraia só os pontos essenciais que um gestor precisa lembrar.
- Máximo 350 palavras.`

  try {
    const resumo = await askHaikuText({
      system,
      user: `Resuma esta base de conhecimento:\n\n${markdown}`,
      maxTokens: 900,
    })
    return NextResponse.json({ resumo })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao gerar resumo' }, { status: 500 })
  }
}
