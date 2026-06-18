import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import PizZip from 'pizzip'

export const maxDuration = 300

// Regras extraídas diretamente do processo interno de parametrização do Nex
const SYSTEM_PROMPT = `Você é especialista em parametrização de contratos DOCX para o Nex Coworking (Curitiba/PR).

## Formato dos marcadores
- Sempre {{snake_case}}, minúsculo, sem acentos, dentro de chaves duplas
- O nome descreve o conteúdo: {{valor_mensal}}, não {{campo_5}}
- Se o original usar [CHAVE] (colchetes e maiúsculas), converter para {{chave}}

## O que parametrizar
Todos os dados do contratante que variam de cliente para cliente:
nome, CPF/CNPJ, endereços, e-mail, valores, datas, quantidades, descrições de pagamento.
Mesmo que um valor pareça "fixo" no exemplo — o exemplo é só uma referência preenchida.

## O que NÃO parametrizar (manter fixo)
- Dados da Contratada: "Coletivo Batel Espaço de Coworking LTDA", CNPJ 29.556.773/0001-50, sede jurídica, logos
- Texto jurídico das cláusulas (objeto, obrigações, rescisão, foro, penalidades)
- Estrutura, numeração de cláusulas, layout

## Regra especial: unidade física
- Unidade varia por contrato (ex: EV Comercial pode ser em qualquer unidade): parametrizar com {{unidade_endereco}}, {{unidade_cep}}, {{unidade_telefone}}, {{unidade_email}}
- Unidade fixa para o produto: deixar fixo no template

## Tokens já existentes no sistema (reutilize quando o campo bater exatamente)
nome_cliente, cpf_cnpj, email_cliente, endereco_cliente, cep_cliente, cidade_estado_cliente,
data_inicio, data_fim, data_assinatura, valor_mensal, valor_base, valor_adesao, valor_tabela,
renovacao_texto, modalidade_pagamento, domicilio_fiscal, opcao, sala, vigencia_label,
data_contrato_originario, unidade_endereco, unidade_cep, unidade_telefone, unidade_email,
nome_responsavel, cpf_responsavel, rg_responsavel, data_nascimento_responsavel, cel_coworker,
descricao_pagamento, qualificacao_coworker_pf, nome_evento, data_evento, data_evento_exibicao,
valor_mensal_2, bonus_impressoes, qtd_mesa_trabalho, qtd_cadeira, qtd_armario,
taxa_adesao, desconto_adesao, desconto_mensalidades, obs_evento

## Campos de texto livre (use um único campo em vez de vários fragmentados)
- {{descricao_pagamento}}: absorve qualquer condição de pagamento (à vista, parcelado, faturamento) em uma descrição textual
- {{qualificacao_coworker_pf}}: absorve toda qualificação civil da PF (nacionalidade, estado civil, profissão, nascimento, RG, CPF, endereço) em bloco corrido

## Formato de resposta OBRIGATÓRIO
Retorne APENAS um objeto JSON válido, sem markdown, sem explicações fora do JSON:

{
  "substituicoes": [
    {
      "original": "texto EXATAMENTE como aparece no contrato — mesma capitalização, pontuação, espaços",
      "token": "nome_do_campo_sem_chaves",
      "contexto": "...trecho de ~80 chars com {{token}} já aplicado para mostrar contexto..."
    }
  ],
  "campos_json": [
    {"nome": "nome_do_campo", "label": "Label legível para o formulário", "tipo": "text", "obrigatorio": true}
  ]
}

Tipos válidos para campos_json: "text", "date", "number", "select", "textarea"
Para "select" inclua: "opcoes": ["opção1", "opção2"]
Ordem de campos_json: do mais importante para o menos importante (nome, cpf, datas, valores, etc.)
CRÍTICO: o campo "original" deve ser a string EXATA do contrato — sem alterar nada.`

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
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada. Adicione no painel do Railway.' },
      { status: 500 }
    )
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const historicoRaw = formData.get('historico') as string | null
  const mensagem = (formData.get('mensagem') as string | null) ?? ''
  const historico: { role: 'user' | 'assistant'; content: string }[] =
    historicoRaw ? JSON.parse(historicoRaw) : []

  if (!file) return NextResponse.json({ error: 'Arquivo DOCX não enviado' }, { status: 400 })

  // Extrai document.xml do .docx
  const arrayBuf = await file.arrayBuffer()
  let zip: PizZip
  try {
    zip = new PizZip(Buffer.from(arrayBuf))
  } catch {
    return NextResponse.json({ error: 'Arquivo inválido — não é um .docx válido' }, { status: 422 })
  }

  const docXml = zip.file('word/document.xml')?.asText()
  if (!docXml) {
    return NextResponse.json({ error: 'document.xml não encontrado. Verifique se o arquivo é um .docx.' }, { status: 422 })
  }

  const texto = textoDoXML(docXml)

  // Monta mensagens para o Claude
  let messages: { role: 'user' | 'assistant'; content: string }[]

  if (historico.length === 0) {
    // Primeira chamada: envia o texto completo
    messages = [{
      role: 'user',
      content: `Texto do contrato (extraído do .docx):\n\n${texto}\n\nIdentifique todos os dados variáveis e retorne o JSON de substituições conforme as instruções.`,
    }]
  } else {
    // Chamada de edição: historico já contém o texto inicial e a resposta anterior
    messages = [...historico, { role: 'user', content: mensagem }]
  }

  const client = new Anthropic()
  let respText: string
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages,
    })
    respText = response.content.find(c => c.type === 'text')?.text ?? ''
  } catch (e: any) {
    return NextResponse.json({ error: `Erro na API Claude: ${e?.message ?? 'desconhecido'}` }, { status: 500 })
  }

  // Parseia JSON da resposta
  let parsed: {
    substituicoes: Array<{ original: string; token: string; contexto?: string }>
    campos_json: Array<Record<string, unknown>>
  }
  try {
    const match = respText.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(match?.[0] ?? '{}')
    if (!Array.isArray(parsed.substituicoes)) throw new Error('Formato inválido')
  } catch {
    return NextResponse.json({
      error: 'Claude retornou formato inesperado. Tente novamente.',
      raw: respText.slice(0, 800),
    }, { status: 500 })
  }

  // Aplica substituições no XML por string replacement
  let xmlModificado = docXml
  const aplicadas: string[] = []
  const naoAplicadas: Array<{ original: string; token: string }> = []

  for (const sub of parsed.substituicoes) {
    if (!sub.original || !sub.token) continue
    const tokenStr = `{{${sub.token.replace(/[{}]/g, '')}}}`
    if (xmlModificado.includes(sub.original)) {
      xmlModificado = xmlModificado.split(sub.original).join(tokenStr)
      aplicadas.push(sub.token)
    } else {
      naoAplicadas.push({ original: sub.original, token: sub.token })
    }
  }

  // Reempacota o .docx com o XML modificado
  zip.file('word/document.xml', xmlModificado)
  const docBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  const docxBase64 = docBuffer.toString('base64')

  // Histórico atualizado para a próxima chamada de edição
  const novoHistorico = [...messages, { role: 'assistant' as const, content: respText }]

  return NextResponse.json({
    docxBase64,
    substituicoes: parsed.substituicoes,
    campos_json: parsed.campos_json ?? [],
    aplicadas,
    naoAplicadas,
    historico: novoHistorico,
  })
}
