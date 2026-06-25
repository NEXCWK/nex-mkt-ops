import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_MODEL } from '@/lib/anthropic'
import { withNexVoice } from '@/lib/nex-voice'
import PizZip from 'pizzip'

export const maxDuration = 300

const SYSTEM_PROMPT = `Você é especialista em edição de contratos DOCX já cadastrados no sistema do Nex Coworking (Curitiba/PR).

Você recebe o texto extraído de um contrato .docx que JÁ está no sistema (já parametrizado, com marcadores {{}}). O usuário pede alterações em linguagem natural e você as aplica DIRETAMENTE no documento.

## Como você edita
Você NÃO reescreve o documento inteiro. Você devolve uma lista de OPERAÇÕES de busca-e-substituição. Cada operação localiza um trecho EXATO do texto atual e o substitui pelo novo texto.

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
  "resposta": "explicação curta e clara ao usuário do que você alterou (1-3 frases)",
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

- "operacoes" pode ser vazio se o pedido for só uma pergunta — nesse caso responda em "resposta".
- "campos_novos" só inclui marcadores NOVOS que você criou (não os já existentes). Pode ser omitido/vazio.
- Tipos válidos: "text", "date", "number", "select", "textarea". Para "select" inclua "opcoes": [...].
- CRÍTICO: "buscar" deve ser a string EXATA como aparece no texto atual fornecido — sem inventar, sem reformatar.`

function textoDoXML(xml: string): string {
  const matches = [...xml.matchAll(/<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>/g)]
  return matches.map(m => m[1]).join(' ').replace(/\s+/g, ' ').trim()
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['gestor', 'admin'].includes(session.user.perfil ?? '')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no ambiente.' }, { status: 500 })
  }

  const { tipo, historico, mensagem } = await req.json()
  if (!tipo) return NextResponse.json({ error: 'Selecione um template' }, { status: 400 })
  if (!mensagem?.trim()) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

  const supabase = createServerClient()

  // Busca a versão mais recente do template
  const { data: template } = await supabase
    .from('templates_documentos')
    .select('*')
    .eq('tipo', tipo)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!template?.arquivo_url) {
    return NextResponse.json({ error: `Template "${tipo}" não encontrado no sistema.` }, { status: 404 })
  }

  // Baixa o .docx do Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('templates')
    .download(template.arquivo_url)
  if (downloadError || !fileData) {
    return NextResponse.json({ error: `Falha ao baixar o template do Storage: ${downloadError?.message ?? ''}` }, { status: 500 })
  }

  const arrayBuf = await fileData.arrayBuffer()
  let zip: PizZip
  try {
    zip = new PizZip(Buffer.from(arrayBuf))
  } catch {
    return NextResponse.json({ error: 'Arquivo do template é inválido.' }, { status: 422 })
  }
  const docXml = zip.file('word/document.xml')?.asText()
  if (!docXml) {
    return NextResponse.json({ error: 'document.xml não encontrado no template.' }, { status: 422 })
  }
  const texto = textoDoXML(docXml)

  // Monta mensagens (mantém histórico da conversa de edição)
  const hist: { role: 'user' | 'assistant'; content: string }[] = Array.isArray(historico) ? historico : []
  const messages: { role: 'user' | 'assistant'; content: string }[] =
    hist.length === 0
      ? [{
          role: 'user',
          content: `Template atual: "${template.nome}" (${tipo}).\n\nTexto extraído do .docx:\n\n${texto}\n\nPedido do usuário: ${mensagem}`,
        }]
      : [...hist, { role: 'user', content: mensagem }]

  const client = new Anthropic()
  let respText: string
  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      system: withNexVoice(SYSTEM_PROMPT),
      messages,
    })
    respText = response.content.find(c => c.type === 'text')?.text ?? ''
  } catch (e) {
    return NextResponse.json({ error: `Erro na API Claude: ${e instanceof Error ? e.message : 'desconhecido'}` }, { status: 500 })
  }

  let parsed: {
    resposta?: string
    operacoes?: Array<{ buscar: string; substituir: string }>
    campos_novos?: Array<Record<string, unknown>>
  }
  try {
    const match = respText.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(match?.[0] ?? '{}')
  } catch {
    return NextResponse.json({ error: 'Claude retornou um formato inesperado. Tente reformular o pedido.', raw: respText.slice(0, 800) }, { status: 500 })
  }

  const operacoes = Array.isArray(parsed.operacoes) ? parsed.operacoes : []

  // Aplica operações no XML
  let xmlModificado = docXml
  const aplicadas: Array<{ buscar: string; substituir: string }> = []
  const naoAplicadas: Array<{ buscar: string; substituir: string }> = []
  for (const op of operacoes) {
    if (!op?.buscar) continue
    if (xmlModificado.includes(op.buscar)) {
      xmlModificado = xmlModificado.split(op.buscar).join(op.substituir ?? '')
      aplicadas.push(op)
    } else {
      naoAplicadas.push(op)
    }
  }

  let novaVersao = template.versao ?? 1

  // Se houve alteração efetiva, regrava o .docx no Storage e bump de versão
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
      return NextResponse.json({ error: `Falha ao salvar no Storage: ${uploadError.message}` }, { status: 500 })
    }

    novaVersao = (template.versao ?? 1) + 1

    // Mescla campos novos no campos_json existente
    let camposJson = Array.isArray(template.campos_json) ? template.campos_json : []
    const novos = Array.isArray(parsed.campos_novos) ? parsed.campos_novos : []
    if (novos.length > 0) {
      const existentes = new Set(camposJson.map((c: Record<string, unknown>) => c.nome))
      camposJson = [...camposJson, ...novos.filter(c => !existentes.has(c.nome))]
    }

    await supabase
      .from('templates_documentos')
      .update({ versao: novaVersao, campos_json: camposJson, criado_por: session.user.email })
      .eq('id', template.id)
  }

  const novoHistorico = [...messages, { role: 'assistant' as const, content: respText }]

  return NextResponse.json({
    resposta: parsed.resposta ?? (aplicadas.length > 0 ? 'Alterações aplicadas.' : 'Nenhuma alteração aplicada.'),
    aplicadas,
    naoAplicadas,
    camposNovos: parsed.campos_novos ?? [],
    versao: novaVersao,
    salvo: aplicadas.length > 0,
    historico: novoHistorico,
  })
}
