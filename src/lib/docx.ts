import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatDateExtenso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${y}`
}

export function formatDateAssinaturaLocal(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `Curitiba, ${d} de ${MESES[m - 1]} de ${y}`
}

// Campos de data usados em texto corrido (preâmbulo) por tipo de documento:
// recebem a forma por extenso em vez de dd/mm/aaaa.
const CAMPOS_EXTENSO: Record<string, string[]> = {
  termo_eventos: ['data_evento'],
  termo_eventos_residentes: ['data_evento'],
  termo_diaria_reuniao: ['data_evento'],
}

// Campos que são categorias/seleções (não dados de identificação do cliente) e por
// isso NÃO entram em maiúsculas — ficam como o texto definido nas opções do formulário.
const CAMPOS_SEM_MAIUSCULA = new Set([
  'vigencia_label', 'modalidade_pagamento', 'unidade_selector', 'genero_coworker',
  'vinculo_representante', 'modalidade_ev', 'email_cliente', 'unidade_email',
  'forma_pagamento_evento',
])

// Periodicidade (por extenso, minúsculo) exibida junto ao valor base do EV,
// derivada da modalidade de pagamento já selecionada no formulário.
const EV_PERIODICIDADE: Record<string, string> = {
  'Mensal': 'mensal',
  'Semestral': 'semestral',
  'Anual à vista': 'anual',
  'Anual parcelado': 'anual',
}

/**
 * Padroniza os dados do cliente (nome, endereço, e-mail, telefone, etc.) em
 * MAIÚSCULAS no documento final, independente de como foram digitados no
 * formulário — convenção comum em qualificações de contrato. Não afeta datas
 * ISO (formatadas à parte) nem campos de categoria/seleção (CAMPOS_SEM_MAIUSCULA).
 */
function paraMaiusculas(campos: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(campos)) {
    out[k] = (typeof v === 'string' && !ISO_DATE.test(v) && !CAMPOS_SEM_MAIUSCULA.has(k)) ? v.toUpperCase() : v
  }
  return out
}

/**
 * Qualificação civil da PF (COWORKER), a partir do nome — usada no aditivo PF→PJ.
 * O template já escreve o nome em negrito separadamente antes deste marcador (em
 * dois pontos do documento: como CONTRATANTE e, de novo, como representante da
 * INTERVENIENTE-ANUENTE), então o retorno NÃO repete o nome nem os cabeçalhos
 * "Na qualidade de..." — só o restante da qualificação (nacionalidade, RG, CPF,
 * endereço etc.), evitando duplicar o texto ao ser inserido nos dois lugares.
 */
function splitCidadeEstado(v: string): [string, string] {
  const idx = v.indexOf('/')
  if (idx === -1) return [v, '']
  return [v.slice(0, idx).trim(), v.slice(idx + 1).trim()]
}

function composeQualificacaoPfParaPj(c: Record<string, string>): string {
  const isFem = c.genero_coworker !== 'Masculino'
  const nascidoA   = isFem ? 'nascida'             : 'nascido'
  const portadorA  = isFem ? 'portadora'            : 'portador'
  const inscritaO  = isFem ? 'inscrita'             : 'inscrito'
  const residenteA = isFem ? 'residente e domiciliada' : 'residente e domiciliado'

  const dataNasc = ISO_DATE.test(c.data_nascimento_responsavel ?? '')
    ? formatDateBR(c.data_nascimento_responsavel)
    : (c.data_nascimento_responsavel ?? '')

  const endPF = [
    c.endereco_coworker,
    c.complemento_coworker,
    c.bairro_coworker ? `Bairro ${c.bairro_coworker}` : '',
    c.cidade_estado_coworker,
    c.cep_coworker ? `CEP:${c.cep_coworker}` : '',
  ].filter(Boolean).join(', ')

  return (
    `${c.nacionalidade_coworker ?? ''}, ` +
    `${c.estado_civil_coworker ?? ''}, ${nascidoA} em ${dataNasc}, ` +
    `${c.profissao_coworker ?? ''}, ${portadorA} da Carteira de Identidade Civil ` +
    `RG nº ${c.rg_responsavel ?? ''} ${c.orgao_rg_coworker ?? ''}, ` +
    `e ${inscritaO} no CPF/MF nº ${c.cpf_responsavel ?? ''}, ` +
    `${residenteA} na ${endPF}`
  )
}

export function formatarCamposParaDocumento(
  tipo: string,
  campos: Record<string, string>
): Record<string, string> {
  const extenso = CAMPOS_EXTENSO[tipo] ?? []
  const camposMaiusculos = paraMaiusculas(campos)
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(camposMaiusculos)) {
    if (typeof v === 'string' && ISO_DATE.test(v)) {
      if (k === 'data_assinatura') {
        out[k] = formatDateAssinaturaLocal(v)
      } else if (extenso.includes(k)) {
        out[k] = `o dia ${formatDateExtenso(v)}`
      } else {
        out[k] = formatDateBR(v)
      }
    } else {
      out[k] = v
    }
  }
  if (tipo === 'aditivo_ev_pf_para_pj') {
    out.qualificacao_coworker_pf = composeQualificacaoPfParaPj(camposMaiusculos)
  }
  // Nas tabelas de qualificação dos aditivos, Cidade e Estado ficam em células
  // separadas; o formulário coleta um único campo combinado ("Cidade/UF").
  if ('cidade_estado_coworker' in camposMaiusculos) {
    const [cid, est] = splitCidadeEstado(camposMaiusculos.cidade_estado_coworker ?? '')
    out.cidade_coworker = cid
    out.estado_coworker = est
  }
  if (tipo === 'aditivo_ev_pf_para_pj' && 'cidade_interveniente' in camposMaiusculos) {
    const [cid, est] = splitCidadeEstado(camposMaiusculos.cidade_interveniente ?? '')
    out.cidade_interveniente = cid
    out.estado_interveniente = est
  }
  if ('modalidade_pagamento' in camposMaiusculos) {
    out.periodicidade = EV_PERIODICIDADE[campos.modalidade_pagamento] ?? ''
  }
  if (tipo === 'termo_eventos_residentes') {
    const aVista = campos.forma_pagamento_evento === 'À vista'
    out.pagamento_vista = aVista ? '1' : ''
    out.pagamento_2x = aVista ? '' : '1'
  }
  return out
}

export async function generateDocx(
  templateBuffer: Buffer,
  variables: Record<string, string>
): Promise<Buffer> {
  const zip = new PizZip(templateBuffer)

  let doc: Docxtemplater
  try {
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      // Os templates .docx usam {{marcador}}; o padrão da lib é { }.
      delimiters: { start: '{{', end: '}}' },
      // Campos opcionais vazios viram string vazia em vez de "undefined"
      nullGetter: () => '',
    })
    doc.render(variables)
  } catch (e: any) {
    throw new Error(extrairErroDocx(e))
  }

  return doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  })
}

function extrairErroDocx(e: any): string {
  const errors = e?.properties?.errors
  if (Array.isArray(errors) && errors.length > 0) {
    const detalhes = errors
      .map((err: any) => {
        const tag = err?.properties?.xtag ?? err?.properties?.id ?? ''
        const explicacao = err?.properties?.explanation ?? err?.message ?? ''
        return tag ? `${tag}: ${explicacao}` : explicacao
      })
      .filter(Boolean)
      .slice(0, 5)
      .join(' | ')
    return `Erro no template do documento — ${detalhes}`
  }
  return e?.message ?? 'Erro ao gerar o documento'
}
