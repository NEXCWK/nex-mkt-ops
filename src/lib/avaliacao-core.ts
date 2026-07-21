import { askClaudeJSON } from '@/lib/anthropic'
import { createServerClient } from '@/lib/supabase/server'

export const KPIS_ATENDIMENTO = [
  'Cordialidade e tom de voz',
  'Tempo de resposta / agilidade',
  'Clareza e objetividade',
  'Entendimento da necessidade do cliente',
  'Conhecimento do produto/serviço',
  'Condução e técnica de venda (SPIN/qualificação)',
  'Resolução / encaminhamento',
  'Fechamento e próximos passos',
]

export const KPIS_TELEFONE = [
  'Saudação e identificação',
  'Clareza e dicção',
  'Escuta ativa',
  'Entendimento da necessidade do cliente',
  'Conhecimento do produto/serviço',
  'Condução e técnica de venda',
  'Cordialidade e empatia',
  'Encerramento e próximos passos',
]

export interface ConversaIA {
  atendente: string
  data: string | null
  nota: number
  resumo: string
  kpis: { nome: string; nota: number; comentario: string }[]
  pontos_atencao: { tipo: 'objecao' | 'atrito' | 'ponto_forte'; texto: string; trecho: string }[]
  palavras_chave: string[]
  trecho: string
}

export interface ResultadoAvaliacao {
  loteId: string
  totalConversas: number
  notaMedia: number
  conversas: Record<string, unknown>[]
}

/**
 * Avalia um bloco de transcrições com IA, separando por conversa/atendente,
 * e persiste em avaliacoes_lotes + avaliacoes_conversas.
 */
export async function avaliarTranscricoes(opts: {
  tipo: 'atendimento' | 'telefonema'
  transcricoes: string
  operadorEmail: string
  nomeArquivo?: string | null
}): Promise<ResultadoAvaliacao> {
  const { tipo, transcricoes, operadorEmail, nomeArquivo } = opts

  const canal = tipo === 'telefonema' ? 'atendimento por telefone' : 'atendimento via chat (RD Conversas)'
  const kpis = tipo === 'telefonema' ? KPIS_TELEFONE : KPIS_ATENDIMENTO

  const system = `Você é um analista de qualidade (QA) sênior do Nex Coworking (Curitiba/PR), especialista em avaliação de ${canal}.

Você recebe um arquivo de transcrições que pode conter UM OU MAIS atendimentos, de UM OU MAIS atendentes, em qualquer intervalo de datas. O texto pode vir de exportações de PDF (RD Conversas/Tallos), CSV, Excel ou colado manualmente — nesses exports em PDF é comum que a ordem de extração do texto fique fora da ordem visual (ex.: várias linhas de "Nome | data, hora | canal" agrupadas antes das mensagens correspondentes). Interprete o conteúdo com flexibilidade mesmo quando a formatação estiver desalinhada. Quando o arquivo tiver marcadores "--- Arquivo: nome.ext ---", cada bloco entre marcadores é POR PADRÃO pelo menos uma conversa separada. Sua tarefa é:

1. Separar o conteúdo em atendimentos/conversas individuais.
2. Identificar o nome do atendente de cada conversa (procure por marcações como "Atendente:", assinatura, nome citado no início/fim da conversa, ou o nome do remetente das mensagens que não é o cliente — ex.: "*Letícia:* ..." ou "Letícia | data, hora | whatsapp").
3. Avaliar CADA conversa individualmente nos KPIs abaixo (nota de 0 a 10, uma casa decimal):
${kpis.map(k => `- ${k}`).join('\n')}
4. Para cada conversa, extrair os principais pontos de atenção: objeções do cliente, pontos de atrito, ou pontos fortes, cada um com um TRECHO EXATO da transcrição de onde foi extraído (cite literalmente, mas condense em UMA ÚNICA LINHA — sem quebras de linha dentro do trecho).
5. Extrair de 3 a 8 palavras-chave relevantes do assunto tratado (evite palavras genéricas como "olá", "obrigado") de cada conversa.

Regras:
- Seja honesto nas notas: baseie-se apenas no que está na transcrição de cada conversa.
- Se não conseguir identificar o atendente de uma conversa, use "Atendente não Reconhecido" — NUNCA descarte a conversa por não conseguir identificar o atendente.
- Se não conseguir identificar a data, use null.
- "trecho" no nível da conversa deve ser um recorte representativo (até ~400 caracteres), em uma única linha, sem quebras de linha.
- IMPORTANTE: NUNCA retorne uma lista "conversas" vazia. Se o conteúdo existir mas você não conseguir separá-lo claramente em múltiplas conversas, trate o arquivo inteiro (ou cada bloco "--- Arquivo: ... ---") como UMA ÚNICA conversa e avalie-a mesmo assim, usando "Atendente não Reconhecido" se necessário. Uma avaliação aproximada é sempre melhor do que nenhuma.

Responda em JSON:
{
  "conversas": [
    {
      "atendente": "nome do atendente",
      "data": "YYYY-MM-DD ou null",
      "nota": 0-10,
      "resumo": "resumo curto e objetivo desta conversa",
      "kpis": [ { "nome": "<exatamente o nome do KPI>", "nota": 0-10, "comentario": "observação curta" } ],
      "pontos_atencao": [ { "tipo": "objecao|atrito|ponto_forte", "texto": "descrição curta", "trecho": "trecho literal" } ],
      "palavras_chave": ["palavra1", "palavra2"],
      "trecho": "recorte representativo"
    }
  ]
}`

  const result = await askClaudeJSON<{ conversas: ConversaIA[] }>({
    system,
    user: `Transcrições${nomeArquivo ? ` (fonte: ${nomeArquivo})` : ''}:\n\n${transcricoes}`,
    maxTokens: 16000,
    funcionalidade: tipo === 'telefonema' ? 'avaliacao_telefonemas' : 'avaliacao_atendimentos',
    operadorEmail,
  })

  const conversas = Array.isArray(result.conversas) && result.conversas.length > 0
    ? result.conversas
    // Rede de segurança: mesmo se a IA (contra as instruções) devolver vazio, ainda
    // registramos o envio como uma conversa única em vez de bloquear o upload do usuário.
    : [{
        atendente: 'Atendente não Reconhecido',
        data: null,
        nota: 0,
        resumo: 'Não foi possível separar automaticamente esta transcrição em conversas individuais.',
        kpis: [],
        pontos_atencao: [],
        palavras_chave: [],
        trecho: transcricoes.slice(0, 400),
      }]

  const notaMedia = conversas.reduce((s, c) => s + (c.nota || 0), 0) / conversas.length

  const supabase = createServerClient()
  const { data: lote, error: erroLote } = await supabase
    .from('avaliacoes_lotes')
    .insert({
      tipo,
      nome_arquivo: nomeArquivo ?? null,
      total_conversas: conversas.length,
      nota_media: notaMedia,
      operador_email: operadorEmail,
    })
    .select()
    .single()

  if (erroLote) throw new Error(erroLote.message)

  const linhas = conversas.map(c => ({
    lote_id: lote.id,
    tipo,
    atendente: c.atendente || 'Atendente não Reconhecido',
    data: c.data || null,
    nota: c.nota,
    resumo: c.resumo,
    kpis: c.kpis ?? [],
    pontos_atencao: c.pontos_atencao ?? [],
    palavras_chave: c.palavras_chave ?? [],
    trecho: c.trecho ?? '',
  }))

  const { error: erroConversas } = await supabase.from('avaliacoes_conversas').insert(linhas)
  if (erroConversas) throw new Error(erroConversas.message)

  return { loteId: lote.id, totalConversas: conversas.length, notaMedia, conversas: linhas }
}
