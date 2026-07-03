import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { askClaudeJSON, assertApiKey } from '@/lib/anthropic'
import { withNexVoice } from '@/lib/nex-voice'
import { renderLP, type ModeloLP, type ValoresLP } from '@/lib/lp-templates'

export const maxDuration = 300

const SCHEMA: Record<ModeloLP, string> = {
  lsl: `page_title, meta_description, hero_tag, hero_title, hero_subtitle, hero_body_1, hero_body_2 (opcional),
benefits_eyebrow, benefits_title, benefit_cards (EXATAMENTE 3 objetos {title, description}),
urgency_text, form_eyebrow, form_lead_title, form_lead_body, form_bullets (3-5 strings),
form_card_title, form_card_note, form_cta,
regulation_eyebrow, regulation_title, regulation_intro, regulation_items (6-10 strings; inclua sempre "Promoção não cumulativa com outras ofertas." e "A Nex reserva-se o direito de encerrar a promoção a qualquer momento.")`,
  vsl: `page_title, meta_description, hero_tag, hero_title, hero_subtitle, hero_body (1 parágrafo curto),
video_eyebrow, video_title, video_intro,
benefits_eyebrow, benefits_title, benefit_cards (EXATAMENTE 3 objetos {title, description}),
urgency_text, form_eyebrow, form_lead_title, form_lead_body, form_bullets (3-5 strings),
form_card_title, form_card_note, form_cta,
regulation_eyebrow, regulation_title, regulation_intro, regulation_items (6-10 strings)`,
  squeeze: `page_title, meta_description, hero_tag, hero_title, hero_subtitle (o hook comercial, com número/percentual/prazo),
hero_body (1 parágrafo curto), lead_bullets (3-5 strings),
urgency_text, form_card_title, form_card_note, form_cta`,
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiErr = assertApiKey()
  if (apiErr) return NextResponse.json({ error: apiErr }, { status: 500 })

  const body = await req.json()
  const modelo = (body.modelo ?? 'lsl') as ModeloLP
  const { produto, vigencia, desconto, instrucoes, heroImage, rdEmbed, videoEmbed } = body

  if (!['lsl', 'vsl', 'squeeze'].includes(modelo)) {
    return NextResponse.json({ error: 'Modelo inválido' }, { status: 400 })
  }
  if (!produto) return NextResponse.json({ error: 'Informe o produto' }, { status: 400 })

  const system = `Você é copywriter de performance do Nex Coworking (Curitiba/PR). Você escreve o CONTEÚDO (copy) de uma landing page de condição especial no modelo "${modelo.toUpperCase()}". O layout, a tipografia (Proxima Nova) e o CSS são fixos — você só escreve o texto dos campos.

Regras de tom (obrigatórias):
- Português do Brasil. Frases curtas, diretas. Sem gerúndio, sem exclamação, sem superlativo vazio ("o melhor", "incrível").
- Títulos com peso leve (o design usa peso 400) — não escreva em caixa-alta nem force ênfase.
- Não use as palavras "comunidade" nem "networking".
- O subtítulo do hero deve conter a promessa concreta (número, percentual, prazo) quando houver.
- CTAs no estilo "Enviar para o time comercial" / "Quero a condição especial" / "Solicitar proposta".
- page_title padrão: "<Assunto> em Curitiba — Condição Especial | Nex".

Gere DUAS variações de copy visivelmente diferentes entre si (ângulos/argumentos distintos), ambas seguindo o mesmo conjunto de campos.

Campos deste modelo (${modelo.toUpperCase()}):
${SCHEMA[modelo]}

Responda em JSON:
{
  "variantes": [
    { "nome": "Opção 1", "valores": { <todos os campos acima> } },
    { "nome": "Opção 2", "valores": { <todos os campos acima> } }
  ]
}`

  const brief = [
    `Produto: ${produto}`,
    vigencia ? `Vigência da ação comercial: ${vigencia}` : null,
    desconto ? `Desconto / condição especial: ${desconto}` : null,
    instrucoes ? `Instruções extras: ${instrucoes}` : null,
  ].filter(Boolean).join('\n')

  try {
    const result = await askClaudeJSON<{ variantes: { nome: string; valores: ValoresLP }[] }>({
      system: withNexVoice(system),
      user: `Brief da landing page:\n${brief}`,
      maxTokens: 12000,
    })

    const variantes = (result.variantes ?? []).map((varr, i) => {
      const valores: ValoresLP = {
        ...varr.valores,
        hero_image: heroImage || undefined,
        rd_embed: rdEmbed || undefined,
        video_embed: videoEmbed || undefined,
      }
      return { nome: varr.nome || `Opção ${i + 1}`, html: renderLP(modelo, valores) }
    })

    return NextResponse.json({ modelo, variantes })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao gerar LP' }, { status: 500 })
  }
}
