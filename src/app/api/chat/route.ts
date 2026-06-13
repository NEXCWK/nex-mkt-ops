import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { EMAIL_TEMPLATES, MARCADORES_DEF } from '@/app/(dashboard)/emails/novo/templates-data'
import { TIPOS_CONTRATO, TIPOS_ADITIVO } from '@/types'

export const maxDuration = 300

function buildSystemPrompt(): string {
  const templates = EMAIL_TEMPLATES.map(t =>
    `### [${t.id}] ${t.grupo} — ${t.titulo}\nQuando usar: ${t.trigger}\nAssunto: ${t.assunto || '(sem assunto)'}\n${t.notaInterna ? `Nota interna: ${t.notaInterna}\n` : ''}Corpo:\n${t.corpo}`
  ).join('\n\n')

  const marcadores = Object.values(MARCADORES_DEF)
    .map(m => `- {{${m.nome}}} — ${m.label} (${m.tipo}${m.opcoes ? `: ${m.opcoes.join(' | ')}` : ''}${m.global ? ', global' : ''})`)
    .join('\n')

  const contratos = TIPOS_CONTRATO.map(t => `- ${t.value}: ${t.label}`).join('\n')
  const aditivos = TIPOS_ADITIVO.map(t => `- ${t.value}: ${t.label}`).join('\n')

  return `Você é o assistente interno do Nex Ops, o sistema de gestão operacional do Nex Coworking (Curitiba/PR). Sua função é ajudar a equipe a corrigir, melhorar, substituir e criar modelos de e-mail e templates de contrato.

## Sobre o sistema
- Aba "Novo E-mail": 16 templates de e-mail com marcadores {{assim}}, preview em tempo real, cópia formatada para Gmail (Sans Serif, negrito só em títulos de seção em MAIÚSCULAS e listas com "- ").
- Aba "Novo Contrato": gera .docx via docxtemplater a partir de templates com marcadores {{assim}} armazenados no Supabase Storage.
- Os templates de e-mail são definidos em código (src/app/(dashboard)/emails/novo/templates-data.ts). Os templates de contrato são arquivos .docx.

## Como ajudar
- Quando pedirem para corrigir/melhorar um e-mail: reescreva o texto completo do template, mantendo os marcadores {{}} existentes (ou propondo novos quando fizer sentido), no mesmo tom da marca.
- Quando pedirem um template novo: entregue título, gatilho de uso (quando usar), assunto, corpo com marcadores e a lista de marcadores usados.
- Quando pedirem alteração em contrato: indique o texto da cláusula pronto para colar no .docx, com os marcadores corretos.
- Sempre entregue o texto FINAL pronto para copiar — a equipe cola o resultado no sistema ou repassa ao desenvolvedor para atualizar o código.
- Tom da marca Nex: próximo, direto, profissional sem ser formal demais. Saudação "Olá, {{nome_cliente}}! Tudo bem?" e fechos como "Abraços," ou "Atenciosamente,". Assinatura institucional: "Nex | o futuro do trabalho se manifesta aqui."
- Convenções: títulos de seção em MAIÚSCULAS viram negrito no Gmail; listas usam "- "; telefone WhatsApp (41) 3122-8801; horário seg-sex 8h às 19h.
- Responda sempre em português brasileiro.

## Marcadores disponíveis
${marcadores}

## Tipos de contrato no sistema
${contratos}

Aditivos:
${aditivos}

## Templates de e-mail atuais
${templates}`
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

  const { messages } = await req.json()
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Mensagens inválidas' }, { status: 400 })
  }

  const client = new Anthropic()

  const stream = client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 64000,
    thinking: { type: 'adaptive' },
    system: [
      {
        type: 'text',
        text: buildSystemPrompt(),
        cache_control: { type: 'ephemeral' },
      },
    ],
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
      } catch (e: any) {
        controller.enqueue(encoder.encode(`\n\n[Erro: ${e?.message ?? 'falha na geração'}]`))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
