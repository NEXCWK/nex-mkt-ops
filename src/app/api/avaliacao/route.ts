import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { askClaudeJSON, assertApiKey } from '@/lib/anthropic'
import { createServerClient } from '@/lib/supabase/server'
import { extrairTextoDeArquivo } from '@/lib/parse-transcricoes'

export const dynamic = 'force-dynamic'
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

interface ConversaIA {
  atendente: string
  data: string | null
  nota: number
  resumo: string
  kpis: { nome: string; nota: number; comentario: string }[]
  pontos_atencao: { tipo: 'objecao' | 'atrito' | 'ponto_forte'; texto: string; trecho: string }[]
  palavras_chave: string[]
  trecho: string
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiErr = assertApiKey()
  if (apiErr) return NextResponse.json({ error: apiErr }, { status: 500 })

  const contentType = req.headers.get('content-type') ?? ''
  let tipo = 'atendimento'
  let transcricoes = ''
  let nomeArquivo: string | null = null

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    tipo = String(form.get('tipo') ?? 'atendimento')
    const file = form.get('arquivo') as File | null
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer())
      transcricoes = await extrairTextoDeArquivo(buffer, file.name)
      nomeArquivo = file.name
    } else {
      transcricoes = String(form.get('transcricoes') ?? '')
    }
  } else {
    const body = await req.json()
    tipo = body.tipo ?? 'atendimento'
    transcricoes = body.transcricoes ?? ''
  }

  if (!transcricoes || !transcricoes.trim()) {
    return NextResponse.json({ error: 'Nenhuma transcrição encontrada no arquivo/texto enviado' }, { status: 400 })
  }

  const canal = tipo === 'telefonema' ? 'atendimento por telefone' : 'atendimento via chat (RD Conversas)'
  const kpis = tipo === 'telefonema' ? KPIS_TELEFONE : KPIS_ATENDIMENTO

  const system = `Você é um analista de qualidade (QA) sênior do Nex Coworking (Curitiba/PR), especialista em avaliação de ${canal}.

Você recebe um arquivo de transcrições que pode conter UM OU MAIS atendimentos, de UM OU MAIS atendentes, em qualquer intervalo de datas (pode ser um dia só ou várias semanas de uma vez). Cada atendimento traz a identificação do atendente responsável no próprio texto. Sua tarefa é:

1. Separar o conteúdo em atendimentos/conversas individuais.
2. Identificar o nome do atendente de cada conversa (procure por marcações como "Atendente:", assinatura, ou nome citado no início/fim da conversa).
3. Avaliar CADA conversa individualmente nos KPIs abaixo (nota de 0 a 10, uma casa decimal):
${kpis.map(k => `- ${k}`).join('\n')}
4. Para cada conversa, extrair os principais pontos de atenção: objeções do cliente, pontos de atrito, ou pontos fortes — cada um com o TRECHO EXATO da transcrição de onde foi extraído (cite literalmente, para que o gestor possa localizar depois).
5. Extrair de 3 a 8 palavras-chave (substantivos e termos relevantes do assunto tratado, evite palavras genéricas como "olá", "obrigado") de cada conversa, para compor uma nuvem de palavras agregada depois.

Regras:
- Seja honesto nas notas: baseie-se apenas no que está na transcrição de cada conversa.
- Se não conseguir identificar o atendente de uma conversa, use "Não identificado".
- Se não conseguir identificar a data, use null.
- "trecho" no nível da conversa deve ser um recorte representativo (até ~400 caracteres) da transcrição da conversa, para exibição como referência.

Responda em JSON:
{
  "conversas": [
    {
      "atendente": "nome do atendente",
      "data": "YYYY-MM-DD ou null",
      "nota": 0-10,
      "resumo": "resumo curto e objetivo desta conversa específica",
      "kpis": [ { "nome": "<exatamente o nome do KPI>", "nota": 0-10, "comentario": "observação curta" } ],
      "pontos_atencao": [ { "tipo": "objecao|atrito|ponto_forte", "texto": "descrição curta do ponto", "trecho": "trecho literal da transcrição" } ],
      "palavras_chave": ["palavra1", "palavra2"],
      "trecho": "recorte representativo da conversa"
    }
  ]
}`

  try {
    const result = await askClaudeJSON<{ conversas: ConversaIA[] }>({
      system,
      user: `Transcrições enviadas${nomeArquivo ? ` (arquivo: ${nomeArquivo})` : ''}:\n\n${transcricoes}`,
      maxTokens: 16000,
    })

    const conversas = Array.isArray(result.conversas) ? result.conversas : []
    if (conversas.length === 0) {
      return NextResponse.json({ error: 'Não foi possível identificar atendimentos nas transcrições enviadas' }, { status: 422 })
    }

    const notaMedia = conversas.reduce((s, c) => s + (c.nota || 0), 0) / conversas.length

    const supabase = createServerClient()
    const { data: lote, error: erroLote } = await supabase
      .from('avaliacoes_lotes')
      .insert({
        tipo,
        nome_arquivo: nomeArquivo,
        total_conversas: conversas.length,
        nota_media: notaMedia,
        operador_email: session.user.email,
      })
      .select()
      .single()

    if (erroLote) return NextResponse.json({ error: erroLote.message }, { status: 500 })

    const linhas = conversas.map(c => ({
      lote_id: lote.id,
      tipo,
      atendente: c.atendente || 'Não identificado',
      data: c.data || null,
      nota: c.nota,
      resumo: c.resumo,
      kpis: c.kpis ?? [],
      pontos_atencao: c.pontos_atencao ?? [],
      palavras_chave: c.palavras_chave ?? [],
      trecho: c.trecho ?? '',
    }))

    const { error: erroConversas } = await supabase.from('avaliacoes_conversas').insert(linhas)
    if (erroConversas) return NextResponse.json({ error: erroConversas.message }, { status: 500 })

    return NextResponse.json({
      loteId: lote.id,
      totalConversas: conversas.length,
      notaMedia,
      conversas: linhas,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha na avaliação' }, { status: 500 })
  }
}
