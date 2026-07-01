import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { askClaudeJSON, assertApiKey } from '@/lib/anthropic'
import { withNexVoice } from '@/lib/nex-voice'
import { createServerClient } from '@/lib/supabase/server'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiErr = assertApiKey()
  if (apiErr) return NextResponse.json({ error: apiErr }, { status: 500 })

  const { produto, vigencia, desconto, objetivo, detalhes, modeloId } = await req.json()
  if (!objetivo) return NextResponse.json({ error: 'Informe o objetivo da LP' }, { status: 400 })

  let referencia = ''
  if (modeloId) {
    const supabase = createServerClient()
    const { data: modelo } = await supabase.from('modelos_referencia').select('*').eq('id', modeloId).single()
    if (modelo) {
      referencia = `\n\nUse como REFERÊNCIA de estilo e estrutura o seguinte modelo cadastrado ("${modelo.nome}"). Adapte o conteúdo ao objetivo pedido, mas siga a linguagem visual e a estrutura dele quando fizer sentido:\n${modelo.html ? `HTML de referência:\n${modelo.html}\n` : ''}${modelo.css ? `CSS de referência:\n${modelo.css}\n` : ''}${modelo.js ? `JS de referência:\n${modelo.js}\n` : ''}`
    }
  }

  const campos = [
    produto ? `Produto: ${produto}` : null,
    vigencia ? `Vigência da ação comercial: ${vigencia}` : null,
    desconto ? `Desconto/condição especial aplicada: ${desconto}` : null,
  ].filter(Boolean).join('\n')

  const system = `Você é um desenvolvedor front-end e copywriter do Nex Coworking (Curitiba/PR). Crie DUAS opções DIFERENTES de landing page de alta conversão, para o usuário escolher a que mais gostar.

Regras para cada opção:
- Entregue HTML/CSS/JS puro (sem frameworks, sem CDNs obrigatórios), separados em "head", "body" e "js".
- "head": tudo que vai dentro de <head> (meta tags, <title>, <style> com todo o CSS inline). NÃO inclua a tag <head> em si.
- "body": tudo que vai dentro de <body> (markup). NÃO inclua a tag <body> em si e NÃO inclua tags <script> aqui.
- "js": o JavaScript da página (validação de formulário, scroll suave, pequenas interações), como um script autossuficiente que pode ser injetado via <script> ou salvo como arquivo .js separado.
- Responsiva (mobile-first), acessível, performática.
- Identidade Nex: amarelo #FFD400 como cor de destaque, preto #0A0A0A, fundo claro, tipografia sans-serif moderna, tom "o futuro do trabalho se manifesta aqui".
- Inclua seções coerentes com o objetivo: hero com headline + CTA, benefícios, prova social, formulário de captação e rodapé.
- Se produto, vigência ou desconto forem informados, destaque-os com clareza na LP (ex.: banner de oferta, urgência da vigência).
- As DUAS opções devem ter abordagens visuais ou de copy visivelmente diferentes entre si (não apenas cores trocadas).
${referencia}

Formato do JSON:
{
  "variantes": [
    { "nome": "Opção 1", "head": "...", "body": "...", "js": "..." },
    { "nome": "Opção 2", "head": "...", "body": "...", "js": "..." }
  ]
}`

  try {
    const result = await askClaudeJSON({
      system: withNexVoice(system),
      user: `Objetivo da landing page: ${objetivo}\n${campos ? `\n${campos}\n` : ''}\nDetalhes/seções/oferta:\n${detalhes || '(não informado — use boas práticas)'}`,
      maxTokens: 16000,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao gerar LP' }, { status: 500 })
  }
}
