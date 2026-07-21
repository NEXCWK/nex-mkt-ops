/**
 * Extrai texto de arquivos de transcrição enviados (CSV, Excel ou texto puro).
 *
 * PDFs NÃO passam por aqui: são enviados nativamente à IA (ver src/lib/avaliacao-core.ts),
 * porque exports em PDF de conversas às vezes são páginas de imagem/print de tela — a
 * extração de texto (pdf-parse) falha silenciosamente nesses casos, devolvendo um texto
 * quase vazio sem sinalizar erro. Deixar a IA ler o PDF diretamente cobre tanto PDFs de
 * texto quanto de imagem.
 */
export async function extrairTextoDeArquivo(buffer: Buffer, nomeArquivo: string): Promise<string> {
  const ext = nomeArquivo.toLowerCase().split('.').pop() ?? ''

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
