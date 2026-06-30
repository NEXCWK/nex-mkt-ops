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

  const qualPF =
    `${c.nome_responsavel ?? ''}, ${c.nacionalidade_coworker ?? ''}, ` +
    `${c.estado_civil_coworker ?? ''}, ${nascidoA} em ${dataNasc}, ` +
    `${c.profissao_coworker ?? ''}, ${portadorA} da Carteira de Identidade Civil ` +
    `RG nº ${c.rg_responsavel ?? ''} ${c.orgao_rg_coworker ?? ''}, ` +
    `e ${inscritaO} no CPF/MF nº ${c.cpf_responsavel ?? ''}, ` +
    `${residenteA} na ${endPF}`

  const endPJ = [
    c.endereco_interveniente,
    c.bairro_interveniente,
    c.cidade_interveniente,
    c.cep_interveniente ? `CEP ${c.cep_interveniente}` : '',
  ].filter(Boolean).join(', ')

  const qualPJ =
    `${c.nome_cliente ?? ''}, pessoa jurídica de direito privado, ` +
    `inscrita no CNPJ/ME n. º ${c.cpf_cnpj ?? ''}, com sede na ${endPJ}, ` +
    `neste ato representada por ${c.vinculo_representante ?? ''} ${qualPF}`

  return (
    `Na qualidade de CONTRATANTE (COWORKER):\n${qualPF};\n\n` +
    `Na qualidade de INTERVENIENTE-ANUENTE:\n${qualPJ};`
  )
}

export function formatarCamposParaDocumento(
  tipo: string,
  campos: Record<string, string>
): Record<string, string> {
  const extenso = CAMPOS_EXTENSO[tipo] ?? []
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(campos)) {
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
    out.qualificacao_coworker_pf = composeQualificacaoPfParaPj(campos)
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
