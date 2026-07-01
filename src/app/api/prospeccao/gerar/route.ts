import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { askClaudeJSON, assertApiKey } from '@/lib/anthropic'
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

Tarefa: a partir do seu conhecimento de mercado e de dados públicos do Brasil (presença em Google, sites institucionais, perfis públicos, bases públicas e APIs gratuitas como ReceitaWS/BrasilAPI por CNPJ), monte uma lista de ${qtd} empresas REAIS e plausíveis para o nicho "${nicho}" na região "${regiao || 'Curitiba/PR'}".

Regras importantes:
- Priorize empresas que provavelmente existem nessa região e nicho. Quando não tiver certeza de um e-mail, deixe "email" como string vazia (a equipe completará) em vez de inventar um endereço falso.
- "contato" = nome de um responsável plausível (sócio, gerente comercial) ou cargo genérico se desconhecido.
- Não invente dados sensíveis; e-mails/telefones só quando forem padrões públicos plausíveis (ex.: contato@dominio.com.br) — caso contrário, vazio.
- ${focoProduto}
- O e-mail deve ser CURTO (no máximo 6 a 8 linhas), sem parágrafos longos.

Formato do JSON:
{
  "empresas": [
    { "empresa": "", "contato": "", "email": "", "telefone": "", "site": "", "segmento": "", "regiao": "", "observacao": "por que é um bom alvo" }
  ],
  "emailTemplate": {
    "assunto": "assunto curto e atrativo, pode usar {{empresa}}",
    "corpo": "e-mail de prospecção curto e pronto, em PT-BR, com as variáveis {{nome}} e {{empresa}}, tom da marca Nex (próximo, direto, profissional), com CTA claro e assinatura 'Equipe Comercial Nex | comercial@nexcoworking.com.br'"
  }
}`

  try {
    const result = await askClaudeJSON({
      system: withNexVoice(system),
      user: `Gere a lista para o nicho "${nicho}" em "${regiao || 'Curitiba/PR'}" e o e-mail de prospecção.`,
      maxTokens: 8000,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao gerar lista' }, { status: 500 })
  }
}
