import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { askClaudeJSON, assertApiKey } from '@/lib/anthropic'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiErr = assertApiKey()
  if (apiErr) return NextResponse.json({ error: apiErr }, { status: 500 })

  const { markdown, instrucao, historico } = await req.json()
  if (!instrucao) return NextResponse.json({ error: 'Instrução vazia' }, { status: 400 })

  const contexto = Array.isArray(historico) && historico.length > 0
    ? `\n\nHistórico recente da conversa:\n${(historico as { role: string; content: string }[]).map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`).join('\n')}`
    : ''

  const system = `Você edita a base de conhecimento (arquivo Markdown) usada pelo Assistente SDR de IA do Nex Coworking (Curitiba/PR).
Você recebe o conteúdo atual do .md e uma instrução de alteração. Aplique a alteração mantendo o restante intacto, preservando a estrutura Markdown, em português brasileiro e no tom da marca Nex.

Responda em JSON:
{
  "resposta": "mensagem curta ao usuário explicando o que foi alterado",
  "markdown": "conteúdo COMPLETO e atualizado do arquivo .md (não apenas o trecho alterado)"
}`

  try {
    const result = await askClaudeJSON({
      system,
      user: `Conteúdo atual do arquivo:\n\n---\n${markdown ?? ''}\n---\n\nInstrução: ${instrucao}${contexto}`,
      maxTokens: 16000,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao editar a base' }, { status: 500 })
  }
}
