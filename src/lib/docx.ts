import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

export async function generateDocx(
  templateBuffer: Buffer,
  variables: Record<string, string>
): Promise<Buffer> {
  const zip = new PizZip(templateBuffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  })

  doc.render(variables)

  const buf = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  })

  return buf
}
