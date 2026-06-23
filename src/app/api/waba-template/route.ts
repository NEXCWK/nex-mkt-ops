import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_MODEL } from '@/lib/anthropic'
import { NEX_VOICE } from '@/lib/nex-voice'

export const maxDuration = 300

const WABA_RULES = `# Regras de Template de mensagem WhatsApp (WABA / Cloud API)

Você gera/edita TEMPLATES de mensagem inicial (template message) para WhatsApp Business Platform, prontos para submeter à aprovação da Meta.

## Estrutura de um template
- **name**: minúsculas, apenas a–z, 0–9 e "_" (sem espaços/acentos). Ex.: boas_vindas_escritorio_virtual.
- **category**: MARKETING, UTILITY ou AUTHENTICATION. Mensagem inicial de prospecção/promoção = MARKETING; confirmação/atualização transacional = UTILITY.
- **language**: pt_BR.
- **components**: HEADER (opcional), BODY (obrigatório), FOOTER (opcional), BUTTONS (opcional).

## Limites de caracteres (rígidos)
- HEADER texto: até 60 caracteres (1 variável no máximo).
- BODY: até 1024 caracteres.
- FOOTER: até 60 caracteres (sem variáveis).
- BUTTONS: texto de cada botão até 25 caracteres; até 10 botões (combinação de "Resposta rápida" e "Chamada para ação"); 1 botão de telefone e até 2 de URL.

## Regras de variáveis
- Use placeholders numerados e sequenciais: {{1}}, {{2}}, {{3}}… (começando em 1, sem pular).
- O BODY NÃO pode começar nem terminar com variável.
- Não pode haver duas variáveis adjacentes (ex.: "{{1}} {{2}}" sem texto entre elas é proibido).
- Para cada variável, forneça um EXEMPLO de preenchimento (ex.: {{1}} = nome do contato, {{2}} = empresa).

## Boas práticas de aprovação
- Sem CAPS LOCK excessivo, sem emojis em excesso, sem pontuação sensacionalista (!!!).
- Sem conteúdo enganoso/abusivo; ser claro sobre quem está falando (Nex).
- Mensagem de marketing precisa ser relevante e ter opção de saída quando aplicável (ex.: botão "Parar promoções").
- Não prometer o que não cumpre; sem URLs encurtadas suspeitas.

## Formato da entrega (sempre em texto, pronto para copiar)
Entregue SEMPRE assim, em texto corrido legível (markdown simples), em português:

Nome: <name>
Categoria: <category>
Idioma: pt_BR

HEADER (se houver): <texto>  [n caracteres]
BODY:
<corpo com {{n}}>  [n caracteres]
FOOTER (se houver): <texto>  [n caracteres]
BOTÕES (se houver):
- [tipo] <texto do botão>

Variáveis / exemplos:
- {{1}} = <descrição/exemplo>
- {{2}} = <descrição/exemplo>

Observações: <ajustes feitos, avisos de limite, sugestão de categoria, etc.>

Ao final, mostre também a contagem de caracteres do BODY e avise se algo passou de algum limite.`

function buildSystem(modo: string): string {
  const tarefa = modo === 'editar'
    ? 'O usuário vai COLAR um texto já pronto. Sua tarefa é adaptá-lo para um template WABA válido e aprovável, ajustando ao tom de voz do Nex e aos limites, preservando a intenção original. Aponte o que mudou e por quê.'
    : 'O usuário vai descrever um briefing. Sua tarefa é GERAR um template WABA completo a partir dele.'
  return `${NEX_VOICE}

Aplique RIGOROSAMENTE o language system e os 4 pilares do tom de voz acima — especialmente afeto e leveza, por ser mensagem de primeiro contato no WhatsApp.

---

${WABA_RULES}

## Sua tarefa
${tarefa}
Responda sempre em português brasileiro, em texto (não em JSON), no formato de entrega especificado. Se o briefing for vago, faça suposições razoáveis e sinalize-as. Use variáveis {{1}}, {{2}} para nome e empresa quando fizer sentido.`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada no ambiente. Adicione a variável no Railway.' },
      { status: 500 }
    )
  }

  const { messages, modo } = await req.json()
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Mensagens inválidas' }, { status: 400 })
  }

  const client = new Anthropic()
  const stream = client.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    system: [{ type: 'text', text: buildSystem(modo), cache_control: { type: 'ephemeral' } }],
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
        controller.close()
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n[Erro: ${e instanceof Error ? e.message : 'falha na geração'}]`))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  })
}
