import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { askClaudeJSON, assertApiKey } from '@/lib/anthropic'

export const maxDuration = 300

const KPIS_ATENDIMENTO = [
  'Cordialidade e tom de voz',
  'Tempo de resposta / agilidade',
  'Clareza e objetividade',
  'Entendimento da necessidade do cliente',
  'Conhecimento do produto/serviço',
  'Condução e técnica de venda (SPIN/qualificação)',
  'Resolução / encaminhamento',
  'Fechamento e próximos passos',
]

const KPIS_TELEFONE = [
  'Saudação e identificação',
  'Clareza e dicção',
  'Escuta ativa',
  'Entendimento da necessidade do cliente',
  'Conhecimento do produto/serviço',
  'Condução e técnica de venda',
  'Cordialidade e empatia',
  'Encerramento e próximos passos',
]

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiErr = assertApiKey()
  if (apiErr) return NextResponse.json({ error: apiErr }, { status: 500 })

  const { tipo, data, transcricoes } = await req.json()
  if (!transcricoes || typeof transcricoes !== 'string' || !transcricoes.trim()) {
    return NextResponse.json({ error: 'Transcrições vazias' }, { status: 400 })
  }

  const canal = tipo === 'telefonema' ? 'atendimento por telefone' : 'atendimento via chat (RD Conversas)'
  const kpis = tipo === 'telefonema' ? KPIS_TELEFONE : KPIS_ATENDIMENTO

  const system = `Você é um analista de qualidade (QA) sênior do Nex Coworking (Curitiba/PR), especialista em avaliação de ${canal}.
Avalie o conjunto de transcrições do dia ${data ?? 'informado'} e produza uma análise diária consolidada, objetiva e acionável, em português brasileiro.

Avalie obrigatoriamente estes KPIs (nota de 0 a 10, uma casa decimal), considerando o conjunto do dia:
${kpis.map(k => `- ${k}`).join('\n')}

Estrutura do JSON de resposta:
{
  "totalAtendimentos": número de atendimentos identificados nas transcrições,
  "notaGeral": média ponderada de 0 a 10 (uma casa decimal),
  "resumoDiario": "parágrafo executivo com a leitura geral do dia, padrões observados e recomendação principal",
  "kpis": [ { "nome": "<exatamente o nome do KPI>", "nota": 0-10, "comentario": "observação curta e específica" } ],
  "pontosFortes": ["..."],
  "pontosMelhoria": ["..."],
  "destaques": [ { "atendente": "<nome se identificável, senão omita>", "observacao": "destaque positivo ou ponto de atenção de um atendimento específico" } ]
}
Seja honesto nas notas: baseie-se apenas no que está nas transcrições. Se algo não puder ser avaliado, atribua nota conservadora e explique no comentário.`

  try {
    const result = await askClaudeJSON({
      system,
      user: `Transcrições do dia:\n\n${transcricoes}`,
      maxTokens: 8000,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha na avaliação' }, { status: 500 })
  }
}
