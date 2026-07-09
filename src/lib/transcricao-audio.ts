/** Transcrição de arquivos de áudio (ligações) para texto, via API de speech-to-text.
 *
 * Os modelos Claude não aceitam áudio; usamos a API de transcrição da OpenAI
 * (Whisper / gpt-4o-transcribe), lendo OPENAI_API_KEY do ambiente (Railway).
 */

/** Extensões de áudio suportadas para upload de ligações. */
const AUDIO_EXTS = new Set(['mp3', 'm4a', 'wav', 'ogg', 'oga', 'opus', 'mpeg', 'mpga', 'webm', 'aac', 'flac'])

/** Limite da API de transcrição da OpenAI (25 MB por arquivo). */
const LIMITE_BYTES = 25 * 1024 * 1024

export function isAudioFile(nomeArquivo: string): boolean {
  const ext = nomeArquivo.toLowerCase().split('.').pop() ?? ''
  return AUDIO_EXTS.has(ext)
}

export function assertTranscribeKey(): string | null {
  if (!process.env.OPENAI_API_KEY) {
    return 'Transcrição de áudio indisponível: configure a variável OPENAI_API_KEY no Railway (usada apenas para converter o áudio em texto).'
  }
  return null
}

/** Converte um buffer de áudio em texto (português). Lança erro com mensagem clara. */
export async function transcreverAudio(buffer: Buffer, nomeArquivo: string): Promise<string> {
  const keyErr = assertTranscribeKey()
  if (keyErr) throw new Error(keyErr)

  if (buffer.byteLength > LIMITE_BYTES) {
    throw new Error(`Arquivo de áudio muito grande (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB). O limite é 25 MB — comprima ou divida a ligação.`)
  }

  const modelo = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1'

  const form = new FormData()
  const blob = new Blob([new Uint8Array(buffer)])
  form.append('file', blob, nomeArquivo)
  form.append('model', modelo)
  form.append('language', 'pt')
  form.append('response_format', 'text')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  })

  if (!res.ok) {
    const detalhe = await res.text().catch(() => '')
    throw new Error(`Falha na transcrição do áudio (${res.status}). ${detalhe.slice(0, 300)}`)
  }

  const texto = (await res.text()).trim()
  if (!texto) throw new Error('A transcrição retornou vazia — verifique se o áudio contém fala audível.')
  return texto
}
