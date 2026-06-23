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

  const { formato, tipo, nSlides, briefing } = await req.json()
  if (!briefing) return NextResponse.json({ error: 'Informe o briefing' }, { status: 400 })

  const dimensao = formato === 'retangulo' ? '1080x1350 (4:5, retângulo vertical)' : '1080x1080 (1:1, quadrado)'
  const qtd = tipo === 'carrossel' ? Math.min(Math.max(Number(nSlides) || 3, 2), 8) : 1

  const system = `Você é um diretor de arte e copywriter de performance do Nex Coworking (Curitiba/PR), criando criativos para anúncios no Instagram.

Cada criativo é um card HTML/CSS COMPLETO e autossuficiente (sem imagens externas, sem CDNs), pensado para ${dimensao}. Use:
- Identidade Nex: amarelo #FFD400 (destaque), preto #0A0A0A, branco, formas geométricas e tipografia sans-serif moderna e pesada.
- Layout que preenche 100% da área (width/height: 100%), com hierarquia clara: headline forte, apoio, e CTA visível.
- Tudo inline no HTML (um <style> dentro do próprio html). O conteúdo deve caber e ficar legível no formato indicado.
- Cada "html" deve ser um documento completo começando em <!DOCTYPE html> e com body sem margens (margin:0).

${tipo === 'carrossel'
  ? `Crie um CARROSSEL com ${qtd} slides com narrativa progressiva (gancho → desenvolvimento → CTA final).`
  : `Crie 1 criativo ESTÁTICO de alto impacto.`}

Formato do JSON:
{
  "slides": [ { "titulo": "rótulo curto do slide", "legenda": "texto principal do slide em poucas palavras", "html": "documento HTML completo do criativo" } ],
  "legendaPost": "legenda do post para o feed do Instagram, com emojis moderados, CTA e 5-8 hashtags relevantes"
}`

  try {
    const result = await askClaudeJSON({
      system: withNexVoice(system),
      user: `Briefing: ${briefing}\n\nFormato: ${dimensao}. Tipo: ${tipo}. ${tipo === 'carrossel' ? `Gere exatamente ${qtd} slides.` : 'Gere 1 criativo.'}`,
      maxTokens: 16000,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao gerar criativos' }, { status: 500 })
  }
}
