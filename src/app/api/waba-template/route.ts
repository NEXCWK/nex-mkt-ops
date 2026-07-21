import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_MODEL } from '@/lib/anthropic'
import { registrarUsoTokens } from '@/lib/uso-tokens'
import { NEX_VOICE } from '@/lib/nex-voice'

export const maxDuration = 300

const WABA_RULES = `# Regras de Template de mensagem WhatsApp (WABA / Cloud API)

Você gera/edita TEMPLATES de mensagem inicial (template message) para WhatsApp Business Platform, prontos para submeter à aprovação da Meta.

## Estrutura de um template
- **name**: minúsculas, apenas a–z, 0–9 e "_" (sem espaços/acentos). Ex.: boas_vindas_escritorio_virtual.
- **category**: MARKETING, UTILITY ou AUTHENTICATION. Mensagem inicial de prospecção/promoção = MARKETING; confirmação/atualização transacional = UTILITY.
- **language**: pt_BR.
- **components**: HEADER (opcional), BODY (obrigatório), FOOTER (opcional), BUTTONS (opcional).

## Limites de caracteres exatos da Meta (rígidos)
- BODY (corpo): até 1024 caracteres.
- HEADER de texto (cabeçalho): até 60 caracteres (1 variável no máximo).
- FOOTER (rodapé): até 60 caracteres (sem variáveis).
- Botão de RESPOSTA RÁPIDA (Quick Reply): até 25 caracteres por botão.
- Botão de CHAMADA PARA AÇÃO (CTA — URL ou telefone): até 20 caracteres no texto do botão.
- Até 10 botões no total (combinação de Resposta rápida e CTA); 1 botão de telefone e até 2 de URL.

## Políticas de conteúdo permitido (Meta)
- Evite SPAM e vendas indesejadas: chamada fria (cold calling), códigos de cupom, brindes e ofertas de upsell NÃO solicitadas costumam ser reprovados.
- Zero ameaças: conteúdo abusivo, ameaçador ou que constranja o cliente é terminantemente proibido.
- Categoria correta (motivo nº 1 de reprovação): MARKETING = promoções/engajamento; UTILITY (Utilidade) = confirmação de agendamentos/pedidos/atualizações transacionais solicitadas; AUTHENTICATION = códigos de verificação (2FA). Classifique com precisão e justifique a escolha.

## Regras de formatação e estilo (Meta)
- Nome do template (name): apenas letras minúsculas, números e underline (ex.: atualizacao_pedido_01). NUNCA use nomes genéricos como "template_123"; o nome deve descrever a intenção.
- Ortografia e gramática impecáveis: sem erros de digitação e sem excesso de abreviações.
- Mensagens diretas: claras e concisas; evite textos vagos ou instruções confusas.
- Emojis com moderação: são permitidos, mas o excesso pode reprovar o template.
- Links confiáveis: use domínios diretos e oficiais; URLs encurtadas (bit.ly e similares) costumam ser reprovadas.
- Sem CAPS LOCK excessivo nem pontuação sensacionalista (!!!). Seja claro sobre quem está falando (Nex).

## Regras para variáveis ({{1}}, {{2}}…)
- Placeholders numerados e sequenciais começando em {{1}} (sem pular números).
- Evite EXCESSO de variáveis: muitas variáveis com pouco texto fixo impedem a Meta de entender a intenção e reprovam o template. Mantenha texto fixo suficiente para dar contexto.
- O texto fixo deve deixar claro o objetivo logo de cara — evite começar apenas com "Olá {{1}}" sem contexto imediato.
- O BODY NÃO pode começar nem terminar com variável, e não pode haver duas variáveis adjacentes (ex.: "{{1}} {{2}}" sem texto entre elas).
- Para cada variável, forneça um EXEMPLO de preenchimento (ex.: {{1}} = nome do contato, {{2}} = empresa).

## Orientação ao usuário
- Se o pedido estiver vago, pergunte (ou assuma e sinalize): qual o objetivo da mensagem (ex.: cobrança, entrega, agendamento, pesquisa, boas-vindas) e qual a categoria pretendida (Marketing ou Utilidade).
- Lembre que o envio/gestão é feito pelo Gerenciador de Negócios da Meta ou pela plataforma de automação integrada.

## Formato da entrega (DUAS PARTES, nesta ordem, sempre em português)

PARTE 1 — Racional (texto livre, markdown simples):
Explique o que desenvolveu e por quê — justificativas das escolhas, conexão com o tom de voz do Nex, categoria sugerida (MARKETING/UTILITY), nome do template (name), e os componentes com seus textos:

Nome: <name>
Categoria: <category>
Idioma: pt_BR
HEADER (se houver): <texto>  [n caracteres]
BODY: <resumo/aviso>  [n caracteres]
FOOTER (se houver): <texto>  [n caracteres]
BOTÕES (se houver): - [tipo] <texto>
Variáveis / exemplos:
- {{1}} = <descrição/exemplo>
- {{2}} = <descrição/exemplo>
Observações: ajustes feitos, avisos de limite e contagem final do BODY.

PARTE 2 — Template limpo:
OBRIGATÓRIO: ao final de TODA resposta, mesmo em respostas de edição ou ajuste, você DEVE escrever numa linha isolada, sem qualquer texto antes ou depois nessa linha, EXATAMENTE este marcador (nada mais):
===TEMPLATE LIMPO===
Em seguida, APENAS o texto final pronto para o time comercial copiar e colar — a mensagem como o cliente vai ler (HEADER se houver, corpo, FOOTER se houver, nesta ordem, com as variáveis no formato {{1}}, {{2}}).
Regras da Parte 2: sem rótulos, sem contagem de caracteres, sem markdown, sem comentários; use uma ÚNICA quebra de linha entre parágrafos — NUNCA linhas em branco duplas/espaçamento duplo.
LEMBRETE CRÍTICO: se você terminar sem escrever ===TEMPLATE LIMPO=== seguido do texto limpo, o sistema não consegue mostrar o template ao usuário. Essa linha é obrigatória em 100% das respostas.`

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
    thinking: { type: 'disabled' },
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
        const finalMessage = await stream.finalMessage()
        void registrarUsoTokens({
          funcionalidade: 'waba_template',
          modelo: CLAUDE_MODEL,
          tokensInput: finalMessage.usage.input_tokens,
          tokensOutput: finalMessage.usage.output_tokens,
          operadorEmail: session.user.email,
        })
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
