import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_MODEL } from '@/lib/anthropic'
import { registrarUsoTokens } from '@/lib/uso-tokens'
import { withNexVoice } from '@/lib/nex-voice'
import { aplicarSubstituicao } from '@/lib/docx-replace'
import PizZip from 'pizzip'

export const maxDuration = 300

const SYSTEM_PROMPT = `Você é especialista em edição de contratos DOCX já cadastrados no sistema do Nex Coworking (Curitiba/PR).

Você recebe o texto extraído de um contrato .docx que JÁ está no sistema (já parametrizado, com marcadores {{}}). O usuário pede alterações em linguagem natural e você as aplica DIRETAMENTE no documento.

## Como você edita
Você NÃO reescreve o documento inteiro. Você devolve uma lista de OPERAÇÕES de busca-e-substituição. Cada operação localiza um trecho EXATO do texto atual e o substitui pelo novo texto.

## Edição em lote (vários contratos)
Quando o mesmo pedido é aplicado a vários contratos diferentes, adapte as operações ao texto REAL de cada documento — o trecho a buscar pode variar entre contratos. Se o pedido não fizer sentido para este documento específico (o trecho não existe), retorne operacoes vazio e explique em "resposta".

## Regras de conteúdo (parametrização Nex)
- Marcadores sempre {{snake_case}}, minúsculo, sem acentos, em chaves duplas. Nunca usar [CHAVE].
- O nome do marcador descreve o conteúdo: {{valor_mensal}}, não {{campo_5}}.
- NUNCA altere dados fixos da Contratada: "Coletivo Batel Espaço de Coworking LTDA", CNPJ 29.556.773/0001-50, sede jurídica, salvo pedido explícito.
- NUNCA altere a estrutura jurídica/numeração de cláusulas, salvo pedido explícito.
- Ao adicionar um campo variável novo, use marcador {{}} e descreva-o em campos_novos.
- Nomenclatura atual do produto: "Grandes Encontros" virou "Diária e Reunião".

## Formato de resposta OBRIGATÓRIO
Retorne APENAS um objeto JSON válido, sem markdown, sem texto fora do JSON:

{
  "resposta": "explicação curta e clara ao usuário do que você alterou neste documento (1-3 frases)",
  "operacoes": [
    {
      "buscar": "trecho EXATO do texto atual a localizar — mesma capitalização, pontuação e espaços",
      "substituir": "novo texto que substitui o trecho"
    }
  ],
  "campos_novos": [
    {"nome": "nome_do_campo", "label": "Label legível", "tipo": "text", "obrigatorio": true}
  ]
}

- "operacoes" pode ser vazio se o pedido for só uma pergunta ou não se aplicar a este documento.
- "campos_novos" só inclui marcadores NOVOS que você criou. Pode ser omitido/vazio.
- Tipos válidos: "text", "date", "number", "select", "textarea". Para "select" inclua "opcoes": [...].
- CRÍTICO: "buscar" deve ser a string EXATA como aparece no texto atual fornecido — sem inventar, sem reformatar.`

type Operacao = { buscar: string; substituir: string }
type TemplateRow = {
  id: string
  tipo: string
  nome: string
  arquivo_url: string | null
  versao: number | null
  campos_json: unknown
}

function textoDoXML(xml: string): string {
  const matches = [...xml.matchAll(/<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>/g)]
  return matches.map(m => m[1]).join(' ').replace(/\s+/g, ' ').trim()
}

function parseJson(respText: string): {
  resposta?: string
  operacoes?: Operacao[]
  campos_novos?: Array<Record<string, unknown>>
} | null {
  try {
    const match = respText.match(/\{[\s\S]*\}/)
    return JSON.parse(match?.[0] ?? '{}')
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['gestor', 'admin'].includes(session.user.perfil ?? '')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  const operadorEmail = session.user.email
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no ambiente.' }, { status: 500 })
  }

  const body = await req.json()
  const mensagem: string = (body.mensagem ?? '').trim()
  // Aceita `tipos: string[]` (lote) ou `tipo: string` (compat)
  const tiposRaw: string[] = Array.isArray(body.tipos)
    ? body.tipos
    : body.tipo ? [body.tipo] : []
  const historico: { role: 'user' | 'assistant'; content: string }[] =
    Array.isArray(body.historico) ? body.historico : []

  if (tiposRaw.length === 0) return NextResponse.json({ error: 'Selecione ao menos um template' }, { status: 400 })
  if (!mensagem) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

  const supabase = createServerClient()
  const client = new Anthropic()
  const emLote = tiposRaw.length > 1

  type Resultado = {
    tipo: string
    nome: string
    resposta: string
    aplicadas: Operacao[]
    naoAplicadas: Operacao[]
    camposNovos: Array<Record<string, unknown>>
    versao: number
    salvo: boolean
    erro?: string
  }

  async function processarTemplate(tipo: string): Promise<Resultado> {
    const { data: template } = await supabase
      .from('templates_documentos')
      .select('*')
      .eq('tipo', tipo)
      .order('versao', { ascending: false })
      .limit(1)
      .maybeSingle<TemplateRow>()

    const nome = template?.nome ?? tipo
    const err = (msg: string): Resultado => ({ tipo, nome, resposta: '', aplicadas: [], naoAplicadas: [], camposNovos: [], versao: template?.versao ?? 0, salvo: false, erro: msg })

    if (!template?.arquivo_url) return err('Template não encontrado no sistema.')

    const { data: fileData, error: downloadError } = await supabase.storage.from('templates').download(template.arquivo_url)
    if (downloadError || !fileData) return err(`Falha ao baixar do Storage: ${downloadError?.message ?? ''}`)

    let zip: PizZip
    try { zip = new PizZip(Buffer.from(await fileData.arrayBuffer())) }
    catch { return err('Arquivo .docx inválido.') }

    const docXml = zip.file('word/document.xml')?.asText()
    if (!docXml) return err('document.xml não encontrado.')

    const texto = textoDoXML(docXml)
    const messages: { role: 'user' | 'assistant'; content: string }[] =
      !emLote && historico.length > 0
        ? [...historico, { role: 'user', content: mensagem }]
        : [{ role: 'user', content: `Template atual: "${nome}" (${tipo}).\n\nTexto extraído do .docx:\n\n${texto}\n\nPedido do usuário: ${mensagem}` }]

    let respText: string
    try {
      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 8192,
        thinking: { type: 'disabled' },
        system: withNexVoice(SYSTEM_PROMPT),
        messages,
      })
      respText = response.content.find(c => c.type === 'text')?.text ?? ''
      void registrarUsoTokens({
        funcionalidade: 'templates_editar',
        modelo: CLAUDE_MODEL,
        tokensInput: response.usage.input_tokens,
        tokensOutput: response.usage.output_tokens,
        operadorEmail,
      })
    } catch (e) {
      return err(`Erro na API Claude: ${e instanceof Error ? e.message : 'desconhecido'}`)
    }

    const parsed = parseJson(respText)
    if (!parsed) return err('Claude retornou formato inesperado.')

    const operacoes = Array.isArray(parsed.operacoes) ? parsed.operacoes : []
    let xmlModificado = docXml
    const aplicadas: Operacao[] = []
    const naoAplicadas: Operacao[] = []
    for (const op of operacoes) {
      if (!op?.buscar) continue
      const r = aplicarSubstituicao(xmlModificado, op.buscar, op.substituir ?? '')
      xmlModificado = r.xml
      if (r.aplicou) aplicadas.push(op)
      else naoAplicadas.push(op)
    }

    let novaVersao = template.versao ?? 1
    if (aplicadas.length > 0) {
      zip.file('word/document.xml', xmlModificado)
      const docBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
      const { error: uploadError } = await supabase.storage
        .from('templates')
        .upload(template.arquivo_url, docBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true,
        })
      if (uploadError) {
        return { tipo, nome, resposta: parsed.resposta ?? '', aplicadas, naoAplicadas, camposNovos: [], versao: template.versao ?? 1, salvo: false, erro: `Falha ao salvar no Storage: ${uploadError.message}` }
      }
      novaVersao = (template.versao ?? 1) + 1

      let camposJson: Record<string, unknown>[] = Array.isArray(template.campos_json) ? template.campos_json : []
      const novos = Array.isArray(parsed.campos_novos) ? parsed.campos_novos : []
      if (novos.length > 0) {
        const existentes = new Set(camposJson.map(c => c.nome))
        camposJson = [...camposJson, ...novos.filter(c => !existentes.has(c.nome))]
      }
      await supabase
        .from('templates_documentos')
        .update({ versao: novaVersao, campos_json: camposJson, criado_por: session?.user.email })
        .eq('id', template.id)
    }

    return {
      tipo,
      nome,
      resposta: parsed.resposta ?? (aplicadas.length > 0 ? 'Alterações aplicadas.' : 'Nenhuma alteração aplicada.'),
      aplicadas,
      naoAplicadas,
      camposNovos: parsed.campos_novos ?? [],
      versao: novaVersao,
      salvo: aplicadas.length > 0,
    }
  }

  // Processa todos em paralelo — reduz N×T para ~T independente do nº de templates
  const settled = await Promise.allSettled(tiposRaw.map(tipo => processarTemplate(tipo)))
  const resultados: Resultado[] = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { tipo: tiposRaw[i], nome: tiposRaw[i], resposta: '', aplicadas: [], naoAplicadas: [], camposNovos: [], versao: 0, salvo: false, erro: r.reason?.message ?? 'Erro inesperado' }
  )

  // Histórico só faz sentido para conversa de um único template
  let novoHistorico = historico
  if (!emLote && resultados.length === 1) {
    const r = resultados[0]
    const ctxInicial = historico.length > 0
      ? historico
      : [{ role: 'user' as const, content: `Template "${r.nome}" (${r.tipo}). Pedido: ${mensagem}` }]
    novoHistorico = [
      ...(historico.length > 0 ? [...historico, { role: 'user' as const, content: mensagem }] : ctxInicial),
      { role: 'assistant' as const, content: r.resposta },
    ]
  }

  return NextResponse.json({ resultados, emLote, historico: novoHistorico })
}
