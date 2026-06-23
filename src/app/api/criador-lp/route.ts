import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { askClaudeJSON, assertApiKey } from '@/lib/anthropic'
import { withNexVoice } from '@/lib/nex-voice'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiErr = assertApiKey()
  if (apiErr) return NextResponse.json({ error: apiErr }, { status: 500 })

  const { modelo, objetivo, detalhes } = await req.json()
  if (!objetivo) return NextResponse.json({ error: 'Informe o objetivo da LP' }, { status: 400 })

  const system = `Você é um desenvolvedor front-end e copywriter do Nex Coworking (Curitiba/PR). Crie uma landing page de alta conversão.

Regras:
- Entregue HTML/CSS/JS puro (sem frameworks, sem CDNs externos obrigatórios), separados em "head" e "body".
- "head": tudo que vai dentro de <head> (meta tags, <title>, <style> com todo o CSS inline na página, fontes via system stack). NÃO inclua a tag <head> em si.
- "body": tudo que vai dentro de <body> (markup + <script> com o JS necessário, ex.: validação de formulário, scroll suave). NÃO inclua a tag <body> em si.
- Responsiva (mobile-first), acessível, performática.
- Identidade Nex: amarelo #FFD400 como cor de destaque, preto #0A0A0A, fundo claro, tipografia sans-serif moderna, tom "o futuro do trabalho se manifesta aqui".
- Inclua seções coerentes com o objetivo: hero com headline + CTA, benefícios, prova social, formulário de captação e rodapé.
- Modelo selecionado: "${modelo}" (os modelos finais serão definidos futuramente; use um layout profissional padrão por enquanto).

Formato do JSON: { "head": "...", "body": "..." }`

  try {
    const result = await askClaudeJSON({
      system: withNexVoice(system),
      user: `Objetivo da landing page: ${objetivo}\n\nDetalhes/seções/oferta:\n${detalhes || '(não informado — use boas práticas)'}`,
      maxTokens: 16000,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao gerar LP' }, { status: 500 })
  }
}
