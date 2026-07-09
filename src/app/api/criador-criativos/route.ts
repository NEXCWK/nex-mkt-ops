import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { askClaudeJSON, assertApiKey } from '@/lib/anthropic'
import { withNexVoice } from '@/lib/nex-voice'
import { createServerClient } from '@/lib/supabase/server'

export const maxDuration = 300

const DIMENSOES: Record<string, string> = {
  quadrado: '1080x1080 (1:1, quadrado)',
  retangulo: '1080x1350 (4:5, retângulo vertical)',
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiErr = assertApiKey()
  if (apiErr) return NextResponse.json({ error: apiErr }, { status: 500 })

  const { titulo, subtitulo, texto, produto, vigencia, desconto, formatos, tipo, nSlides, modeloId } = await req.json()

  const formatosSelecionados: string[] = Array.isArray(formatos) && formatos.length > 0 ? formatos : ['quadrado']
  const qtd = tipo === 'carrossel' ? Math.min(Math.max(Number(nSlides) || 3, 2), 8) : 1

  let referencia = ''
  if (modeloId) {
    const supabase = createServerClient()
    const { data: modelo } = await supabase.from('modelos_referencia').select('*').eq('id', modeloId).single()
    if (modelo) {
      referencia = `\n\nUse como REFERÊNCIA de estilo o seguinte modelo cadastrado ("${modelo.nome}"). Siga a linguagem visual dele:\n${modelo.html ? `HTML de referência:\n${modelo.html}\n` : ''}${modelo.css ? `CSS de referência:\n${modelo.css}\n` : ''}`
    }
  }

  const campos = [
    titulo ? `Título: ${titulo}` : null,
    subtitulo ? `Subtítulo: ${subtitulo}` : null,
    texto ? `Texto/corpo: ${texto}` : null,
    produto ? `Produto: ${produto}` : null,
    vigencia ? `Vigência da ação comercial: ${vigencia}` : null,
    desconto ? `Desconto/condição especial aplicada: ${desconto}` : null,
  ].filter(Boolean).join('\n')

  const system = `Você é um diretor de arte e copywriter de performance do Nex Coworking (Curitiba/PR), criando criativos para anúncios no Instagram.

Gere DUAS opções DIFERENTES de criativo (variantes de abordagem visual/copy, não apenas mudança de cor), para o usuário escolher a que mais gostar. Para CADA opção, gere o criativo nos seguintes formatos, TODOS ao mesmo tempo: ${formatosSelecionados.map(f => `${f} (${DIMENSOES[f] ?? f})`).join(', ')}.

Cada criativo é um card HTML/CSS COMPLETO e autossuficiente (sem imagens externas, sem CDNs). Use:
- Identidade Nex: amarelo #FFD400 (destaque), preto #0A0A0A, branco, formas geométricas e tipografia sans-serif moderna e pesada.
- Layout que preenche 100% da área (width/height: 100%), com hierarquia clara: headline forte, apoio, e CTA visível.
- Tudo inline no HTML (um <style> dentro do próprio html). Body sem margens (margin:0).
- Se título, subtítulo ou texto forem informados, use-os como base do copy (pode adaptar levemente para caber no formato). Se produto, vigência ou desconto forem informados, destaque-os no criativo.
${referencia}

${tipo === 'carrossel'
  ? `Cada opção deve ser um CARROSSEL com ${qtd} slides com narrativa progressiva (gancho → desenvolvimento → CTA final), repetido em cada formato solicitado.`
  : `Cada opção deve ter 1 criativo ESTÁTICO de alto impacto por formato solicitado.`}

Formato do JSON:
{
  "variantes": [
    {
      "nome": "Opção 1",
      "porFormato": {
        ${formatosSelecionados.map(f => `"${f}": [ { "titulo": "rótulo curto do slide", "legenda": "texto principal", "html": "documento HTML completo" } ]`).join(',\n        ')}
      }
    },
    { "nome": "Opção 2", "porFormato": { "...": "mesma estrutura" } }
  ],
  "legendaPost": "legenda do post para o feed do Instagram, com emojis moderados, CTA e 5-8 hashtags relevantes"
}`

  try {
    const result = await askClaudeJSON({
      system: withNexVoice(system),
      user: `${campos || '(nenhum campo estruturado informado — use boas práticas e um tema genérico de alto padrão do Nex)'}\n\nFormatos solicitados: ${formatosSelecionados.join(', ')}. Tipo: ${tipo}. ${tipo === 'carrossel' ? `Gere exatamente ${qtd} slides por formato.` : 'Gere 1 criativo por formato.'}`,
      maxTokens: 16000,
      funcionalidade: 'criador_criativos',
      operadorEmail: session.user.email,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao gerar criativos' }, { status: 500 })
  }
}
