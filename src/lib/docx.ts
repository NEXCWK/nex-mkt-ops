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
  termo_eventos_residentes: ['data_evento'],
  termo_diaria_reuniao: ['data_evento'],
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
