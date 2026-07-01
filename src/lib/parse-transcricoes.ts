/** Extrai texto de arquivos de transcrição enviados (PDF, CSV, Excel ou texto puro). */

export async function extrairTextoDeArquivo(buffer: Buffer, nomeArquivo: string): Promise<string> {
  const ext = nomeArquivo.toLowerCase().split('.').pop() ?? ''

  if (ext === 'pdf') {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    try {
      const resultado = await parser.getText()
      return resultado.text
    } finally {
      await parser.destroy()
    }
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const partes: string[] = []
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(sheet)
      partes.push(`--- Planilha: ${sheetName} ---\n${csv}`)
    }
    return partes.join('\n\n')
  }

  // csv, txt e demais formatos de texto puro
  return buffer.toString('utf-8')
}
