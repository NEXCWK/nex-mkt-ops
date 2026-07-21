import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { askClaudeJSONComBusca, assertApiKey } from '@/lib/anthropic'
import { withNexVoice } from '@/lib/nex-voice'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiErr = assertApiKey()
  if (apiErr) return NextResponse.json({ error: apiErr }, { status: 500 })

  const { tipo, regiao, nicho, quantidade, produto } = await req.json()
  if (!nicho) return NextResponse.json({ error: 'Informe o nicho/segmento' }, { status: 400 })

  const qtd = Math.min(Math.max(Number(quantidade) || 15, 1), 40)

  const objetivo = tipo === 'parcerias'
    ? `prospectar escritórios de contabilidade e contadores para fechar PARCERIAS de Escritório Virtual, especificamente o produto de Endereço Fiscal. O Nex tem um programa de indicação contínuo e validado: o contador (parceiro) indica clientes e recebe repasse financeiro recorrente, e o cliente indicado ganha benefícios na contratação. O e-mail deve focar nesse programa de parceria e indicação, não em venda direta.`
    : `prospecção comercial B2B do Nex Coworking, com foco específico no produto "${produto || 'Salas de Reunião'}".`

  const focoProduto = tipo === 'bdr'
    ? `O e-mail deve ser curto e focado SOMENTE no produto "${produto}" (não misture com outros produtos do portfólio). Estrutura básica: (1) gancho breve relacionado à rotina da empresa, (2) uma frase apresentando o produto e seu principal benefício, (3) CTA claro convidando para uma conversa ou visita.`
    : `O e-mail deve ser curto e focado no programa de indicação de Escritório Virtual (Endereço Fiscal). Estrutura básica: (1) gancho breve sobre a base de clientes do contador, (2) explicação objetiva do programa de indicação (benefício ao cliente indicado + repasse ao parceiro), (3) CTA convidando para conhecer o programa.`

  const system = `Você é um BDR (Business Development Representative) sênior do Nex Coworking (Curitiba/PR). Objetivo: ${objetivo}

Tarefa: use a ferramenta de busca na web para encontrar ${qtd} empresas REAIS para o nicho "${nicho}" na região "${regiao || 'Curitiba/PR'}", cada uma com pelo menos um e-mail de contato REAL e VERIFICÁVEL.

REGRA MAIS IMPORTANTE — NUNCA INVENTE, ADIVINHE OU DEDUZA E-MAILS:
- Todo e-mail incluído no resultado precisa ter sido efetivamente ENCONTRADO por você durante a busca (visto literalmente em uma página real), nunca gerado por padrão (ex.: NUNCA monte "nome.sobrenome@dominio.com" só porque parece plausível).
- Para cada empresa candidata, faça buscas na web cobrindo pelo menos estas três fontes antes de aceitar a empresa na lista:
  1. Site institucional da empresa (páginas de contato/"fale conosco"/rodapé);
  2. Ficha da empresa no Google (Google Meu Negócio/Google Maps/"Perfil da Empresa no Google");
  3. Perfil da empresa (ou de um responsável/sócio) no LinkedIn.
- Se, depois de pesquisar essas três fontes, você não encontrar NENHUM e-mail real publicado para uma empresa candidata, DESCARTE essa empresa por completo — não a inclua no resultado com campo vazio, e não invente um endereço. Em vez disso, continue buscando e substitua por outra empresa real do mesmo nicho/região que tenha e-mail encontrado.
- Só pare de buscar substitutas quando atingir ${qtd} empresas com e-mail real confirmado, ou quando esgotar as buscas razoáveis (nesse caso, retorne quantas encontrar de fato, mesmo que menos que ${qtd} — NUNCA complete a lista com e-mails inventados só para bater a quantidade).
- "contato" = nome real de um responsável (sócio, gerente comercial) SE encontrado nas fontes pesquisadas; caso contrário, deixe como cargo genérico (ex.: "Contato Comercial").
- Para CADA empresa, preencha os e-mails encontrados:
  - "email" (E-mail Principal) = e-mail real de uma PESSOA de contato, se encontrado; senão, use o e-mail institucional real encontrado.
  - "emailSecundario" (E-mail Secundário) = outro e-mail real e distinto do principal (ex.: institucional/genérico do site, se o principal for de uma pessoa), quando encontrado. Se só houver um e-mail real, deixe "emailSecundario" como string vazia — NUNCA duplique ou invente um segundo.
- ${focoProduto}
- O e-mail (template) deve ser CURTO (no máximo 6 a 8 linhas), sem parágrafos longos.

Formato do JSON (retorne SOMENTE isto, sem comentar o processo de busca):
{
  "empresas": [
    { "empresa": "", "contato": "", "email": "", "emailSecundario": "", "telefone": "", "site": "", "segmento": "", "regiao": "", "observacao": "onde o e-mail foi encontrado (ex.: site institucional, Google Meu Negócio, LinkedIn)" }
  ],
  "emailTemplate": {
    "assunto": "assunto curto e atrativo, pode usar {{empresa}}",
    "corpo": "e-mail de prospecção curto e pronto, em PT-BR, com as variáveis {{nome}} e {{empresa}}, tom da marca Nex (próximo, direto, profissional), com CTA claro e assinatura 'Equipe Comercial Nex | comercial@nexcoworking.com.br'"
  }
}`

  try {
    const result = await askClaudeJSONComBusca({
      system: withNexVoice(system),
      user: `Encontre ${qtd} empresas REAIS (com e-mail real e verificado por busca na web) para o nicho "${nicho}" em "${regiao || 'Curitiba/PR'}" e gere o e-mail de prospecção. Não invente nenhum e-mail — descarte e substitua qualquer empresa sem e-mail real encontrado.`,
      maxTokens: 8000,
      maxBuscas: 30,
      funcionalidade: `prospeccao_${tipo === 'parcerias' ? 'parcerias' : 'bdr'}`,
      operadorEmail: session.user.email,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao gerar lista' }, { status: 500 })
  }
}
