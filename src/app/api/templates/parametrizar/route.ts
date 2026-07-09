import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import PizZip from 'pizzip'
import { substituirTodas } from '@/lib/docx-replace'
import { CLAUDE_MODEL } from '@/lib/anthropic'
import { registrarUsoTokens } from '@/lib/uso-tokens'

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

## REUTILIZAÇÃO — não duplicar campos (MUITO IMPORTANTE)
- Se o MESMO dado aparece em vários lugares do contrato (ex: a razão social aparece na qualificação inicial E de novo mais adiante), use SEMPRE o MESMO token nas duas ocorrências. O usuário preenche uma vez e o sistema replica em todos os lugares.
- NÃO crie campos compostos que reempacotam dados já capturados por campos individuais. Ex: se já existem {{nome_cliente}}, {{cpf_cnpj}}, {{endereco_rua}}, NÃO crie um {{qualificacao_membro}} que repete tudo isso — em vez disso, parametrize cada placeholder DENTRO do bloco de qualificação com seu token individual, reaproveitando os mesmos.

## Placeholders no formato antigo [CHAVE]
Se o documento já vem com placeholders [ASSIM] (colchetes), a forma MAIS confiável de parametrizar é mapear cada placeholder distinto para um token. Inclua no JSON o objeto "mapa_colchetes": cada chave é o placeholder EXATO (com colchetes) e o valor é o token (sem chaves). Use o MESMO token para placeholders que representam o mesmo dado. Ex:
"mapa_colchetes": { "[RAZAOSOCIAL]": "nome_cliente", "[CPFCNPJ]": "cpf_cnpj", "[ENDERECORUA]": "endereco_rua" }

## Formato de resposta OBRIGATÓRIO
Retorne APENAS um objeto JSON válido, sem markdown, sem explicações fora do JSON:

{
  "mapa_colchetes": { "[PLACEHOLDER]": "token_sem_chaves" },
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

- Use "mapa_colchetes" quando o documento tiver placeholders [ASSIM]. Use "substituicoes" para documentos preenchidos com dados reais (sem placeholders). Pode usar os dois se necessário.
- Tipos válidos para campos_json: "text", "date", "number", "select", "textarea". Para "select" inclua "opcoes": [...].
- Ordem de campos_json: do mais importante para o menos importante (nome, cpf, datas, valores, etc.)
- Em "campos_json" inclua um campo por token DISTINTO (sem repetir tokens).
CRÍTICO: o campo "original" (em substituicoes) deve ser a string EXATA do contrato — sem alterar nada.`

function textoDoXML(xml: string): string {
  const matches = [...xml.matchAll(/<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>/g)]
  return matches.map(m => m[1]).join(' ').replace(/\s+/g, ' ').trim()
}

// Aliases de placeholders [CHAVE] conhecidos do Nex → token + rótulo + tipo.
// Garante parametrização determinística mesmo quando a IA não mapeia o colchete.
const BRACKET_ALIAS: Record<string, { token: string; label: string; tipo?: string }> = {
  RAZAOSOCIAL: { token: 'nome_cliente', label: 'Nome ou Razão Social' },
  NOMERAZAOSOCIAL: { token: 'nome_cliente', label: 'Nome ou Razão Social' },
  NOMECLIENTE: { token: 'nome_cliente', label: 'Nome ou Razão Social' },
  NOME: { token: 'nome_cliente', label: 'Nome ou Razão Social' },
  CPFCNPJ: { token: 'cpf_cnpj', label: 'CPF ou CNPJ' },
  CNPJ: { token: 'cpf_cnpj', label: 'CPF ou CNPJ' },
  CPF: { token: 'cpf_cnpj', label: 'CPF ou CNPJ' },
  ENDERECORUA: { token: 'endereco_rua', label: 'Rua' },
  RUA: { token: 'endereco_rua', label: 'Rua' },
  LOGRADOURO: { token: 'endereco_rua', label: 'Rua' },
  ENDERECONUMERO: { token: 'endereco_numero', label: 'Número' },
  NUMERO: { token: 'endereco_numero', label: 'Número' },
  ENDERECOCOMPLEMENTO: { token: 'endereco_complemento', label: 'Complemento' },
  COMPLEMENTO: { token: 'endereco_complemento', label: 'Complemento' },
  ENDERECOBAIRRO: { token: 'endereco_bairro', label: 'Bairro' },
  BAIRRO: { token: 'endereco_bairro', label: 'Bairro' },
  ENDERECOCIDADE: { token: 'endereco_cidade', label: 'Cidade' },
  CIDADE: { token: 'endereco_cidade', label: 'Cidade' },
  ENDERECOUF: { token: 'endereco_uf', label: 'UF' },
  UF: { token: 'endereco_uf', label: 'UF' },
  ENDERECOESTADO: { token: 'endereco_estado', label: 'Estado' },
  ESTADO: { token: 'endereco_estado', label: 'Estado' },
  ENDERECOCEP: { token: 'endereco_cep', label: 'CEP' },
  CEP: { token: 'endereco_cep', label: 'CEP' },
  EMAIL: { token: 'email_cliente', label: 'E-mail' },
  EMAILCLIENTE: { token: 'email_cliente', label: 'E-mail' },
  DATAINICIOCONTRATO: { token: 'data_inicio', label: 'Data de Início', tipo: 'date' },
  DATAINICIO: { token: 'data_inicio', label: 'Data de Início', tipo: 'date' },
  DATAASSINATURA: { token: 'data_assinatura', label: 'Data de Assinatura', tipo: 'date' },
  TELEFONE: { token: 'telefone_cliente', label: 'Telefone' },
  CELULAR: { token: 'cel_coworker', label: 'Celular' },
}

/** Normaliza o nome do colchete: remove [], acentos e separadores; deixa MAIÚSCULO. */
function normalizarBracket(b: string): string {
  return b
    .replace(/[[\]]/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
}

function slugifyToken(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

/** Resolve token + rótulo + tipo de um placeholder [CHAVE], com prioridade:
 *  1) mapa explícito da IA  2) alias conhecido do Nex  3) slug do próprio nome. */
function resolverBracket(bracket: string, mapaIA: Record<string, string>): { token: string; label: string; tipo: string } {
  const norm = normalizarBracket(bracket)
  const doMapa = mapaIA[bracket] ? String(mapaIA[bracket]).replace(/[{}]/g, '') : ''
  if (doMapa) {
    const alias = BRACKET_ALIAS[norm]
    return { token: doMapa, label: alias?.label ?? doMapa.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), tipo: alias?.tipo ?? 'text' }
  }
  const alias = BRACKET_ALIAS[norm]
  if (alias) return { token: alias.token, label: alias.label, tipo: alias.tipo ?? 'text' }
  const token = slugifyToken(norm) || 'campo'
  return { token, label: token.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), tipo: 'text' }
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

  // Placeholders no formato antigo [CHAVE] presentes no documento
  const bracketsDetectados = [...new Set(texto.match(/\[[A-ZÀ-Ú0-9_]{2,}\]/g) ?? [])]

  // Monta mensagens para o Claude
  let messages: { role: 'user' | 'assistant'; content: string }[]

  if (historico.length === 0) {
    // Primeira chamada: envia o texto completo
    const avisoBrackets = bracketsDetectados.length > 0
      ? `\n\nO documento contém estes placeholders no formato antigo [CHAVE] — mapeie TODOS em "mapa_colchetes":\n${bracketsDetectados.join(', ')}`
      : ''
    messages = [{
      role: 'user',
      content: `Texto do contrato (extraído do .docx):\n\n${texto}\n\nIdentifique todos os dados variáveis e retorne o JSON conforme as instruções.${avisoBrackets}`,
    }]
  } else {
    // Chamada de edição: historico já contém o texto inicial e a resposta anterior
    messages = [...historico, { role: 'user', content: mensagem }]
  }

  const client = new Anthropic()
  let respText: string
  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages,
    })
    respText = response.content.find(c => c.type === 'text')?.text ?? ''
    void registrarUsoTokens({
      funcionalidade: 'templates_parametrizar',
      modelo: CLAUDE_MODEL,
      tokensInput: response.usage.input_tokens,
      tokensOutput: response.usage.output_tokens,
      operadorEmail: session.user.email,
    })
  } catch (e: any) {
    return NextResponse.json({ error: `Erro na API Claude: ${e?.message ?? 'desconhecido'}` }, { status: 500 })
  }

  // Parseia JSON da resposta
  let parsed: {
    mapa_colchetes?: Record<string, string>
    substituicoes?: Array<{ original: string; token: string; contexto?: string }>
    campos_json?: Array<Record<string, unknown>>
  }
  try {
    const match = respText.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(match?.[0] ?? '{}')
  } catch {
    return NextResponse.json({
      error: 'Claude retornou formato inesperado. Tente novamente.',
      raw: respText.slice(0, 800),
    }, { status: 500 })
  }

  const mapaColchetes = parsed.mapa_colchetes ?? {}
  const substituicoes = Array.isArray(parsed.substituicoes) ? parsed.substituicoes : []
  const TEM_BRACKET = /\[[A-ZÀ-Ú0-9_]{2,}\]/

  // Aplica substituições no XML
  let xmlModificado = docXml
  const aplicadas: string[] = []
  const naoAplicadas: Array<{ original: string; token: string }> = []
  const substituicoesUI: Array<{ original: string; token: string; contexto?: string }> = []
  // Rótulo/tipo derivados dos colchetes, para montar campos_json com bons labels
  const infoPorToken = new Map<string, { label: string; tipo: string }>()

  // 1) DETERMINÍSTICO: converte TODOS os placeholders [CHAVE] detectados no documento.
  //    Substituição global → o mesmo dado repetido vira o mesmo marcador (preenche 1x).
  //    Não depende da IA: usa o mapa dela quando existe, senão alias do Nex, senão slug.
  for (const bracket of bracketsDetectados) {
    const { token, label, tipo } = resolverBracket(bracket, mapaColchetes)
    const r = substituirTodas(xmlModificado, bracket, `{{${token}}}`)
    xmlModificado = r.xml
    substituicoesUI.push({ original: bracket, token, contexto: r.count > 1 ? `aplicado em ${r.count} lugares` : undefined })
    if (r.count > 0) {
      aplicadas.push(token)
      if (!infoPorToken.has(token)) infoPorToken.set(token, { label, tipo })
    } else {
      naoAplicadas.push({ original: bracket, token })
    }
  }

  // 2) Substituições por VALOR preenchido (documentos sem placeholders).
  //    Pula qualquer "original" que ainda contenha colchetes — já tratados acima,
  //    evitando recriar campos compostos duplicados (ex: qualificacao_membro).
  for (const sub of substituicoes) {
    if (!sub.original || !sub.token) continue
    if (TEM_BRACKET.test(sub.original)) continue
    const token = sub.token.replace(/[{}]/g, '')
    const r = substituirTodas(xmlModificado, sub.original, `{{${token}}}`)
    xmlModificado = r.xml
    substituicoesUI.push({ original: sub.original, token, contexto: sub.contexto })
    if (r.count > 0) aplicadas.push(token)
    else naoAplicadas.push({ original: sub.original, token })
  }

  // Reempacota o .docx com o XML modificado
  zip.file('word/document.xml', xmlModificado)
  const docBuffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  const docxBase64 = docBuffer.toString('base64')

  // campos_json deduplicado por token. Garante um campo por token DISTINTO,
  // mesmo que o token apareça em vários lugares (sem pedir o dado duas vezes).
  const camposBase = Array.isArray(parsed.campos_json) ? parsed.campos_json : []
  const tokensUsados = new Set<string>([...aplicadas])
  const camposPorNome = new Map<string, Record<string, unknown>>()
  for (const c of camposBase) {
    const nome = String((c as { nome?: string }).nome ?? '').replace(/[{}]/g, '')
    if (nome) camposPorNome.set(nome, { ...c, nome })
  }
  // Garante um campo para todo token aplicado que não veio em campos_json,
  // usando o rótulo/tipo derivado do colchete quando disponível.
  for (const token of tokensUsados) {
    if (!camposPorNome.has(token)) {
      const info = infoPorToken.get(token)
      const label = info?.label ?? token.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      camposPorNome.set(token, { nome: token, label, tipo: info?.tipo ?? 'text', obrigatorio: true })
    }
  }
  const camposJsonFinal = [...camposPorNome.values()].filter(c => tokensUsados.has(String(c.nome)))

  // Histórico atualizado para a próxima chamada de edição
  const novoHistorico = [...messages, { role: 'assistant' as const, content: respText }]

  return NextResponse.json({
    docxBase64,
    substituicoes: substituicoesUI,
    campos_json: camposJsonFinal,
    aplicadas: [...new Set(aplicadas)],
    naoAplicadas,
    historico: novoHistorico,
  })
}
