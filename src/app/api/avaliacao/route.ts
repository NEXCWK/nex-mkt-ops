import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { assertApiKey } from '@/lib/anthropic'
import { extrairTextoDeArquivo } from '@/lib/parse-transcricoes'
import { isAudioFile, transcreverAudio } from '@/lib/transcricao-audio'
import { avaliarTranscricoes } from '@/lib/avaliacao-core'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const apiErr = assertApiKey()
  if (apiErr) return NextResponse.json({ error: apiErr }, { status: 500 })

  // Garante que QUALQUER falha inesperada (parsing de PDF/planilha, etc.) sempre
  // devolva JSON — caso contrário o cliente recebe corpo vazio/HTML e quebra com
  // "Unexpected end of JSON input" em vez de mostrar o erro real.
  try {
    const contentType = req.headers.get('content-type') ?? ''
    let tipo: 'atendimento' | 'telefonema' = 'atendimento'
    let transcricoes = ''
    let nomeArquivo: string | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      tipo = (String(form.get('tipo') ?? 'atendimento') as 'atendimento' | 'telefonema')
      const files = form.getAll('arquivo').filter((f): f is File => f instanceof File)
      if (files.length > 0) {
        const atendente = String(form.get('atendente') ?? '').trim()
        const partes: string[] = []
        for (const file of files) {
          const buffer = Buffer.from(await file.arrayBuffer())
          if (isAudioFile(file.name)) {
            // Ligação em áudio: transcreve para texto antes de avaliar
            try {
              const texto = await transcreverAudio(buffer, file.name)
              partes.push(atendente ? `[Atendente: ${atendente}]\n${texto}` : texto)
            } catch (e) {
              return NextResponse.json({ error: `${file.name}: ${e instanceof Error ? e.message : 'Falha ao transcrever o áudio'}` }, { status: 400 })
            }
          } else {
            try {
              const texto = await extrairTextoDeArquivo(buffer, file.name)
              partes.push(`--- Arquivo: ${file.name} ---\n${texto}`)
            } catch (e) {
              return NextResponse.json({ error: `Falha ao ler o arquivo "${file.name}": ${e instanceof Error ? e.message : 'formato inválido ou corrompido'}` }, { status: 400 })
            }
          }
        }
        transcricoes = partes.join('\n\n')
        nomeArquivo = files.length === 1 ? files[0].name : `${files.length} arquivos (${files.map(f => f.name).join(', ')})`
      } else {
        transcricoes = String(form.get('transcricoes') ?? '')
      }
    } else {
      const body = await req.json()
      tipo = body.tipo ?? 'atendimento'
      transcricoes = body.transcricoes ?? ''
    }

    if (!transcricoes || !transcricoes.trim()) {
      return NextResponse.json({ error: 'Nenhuma transcrição encontrada no arquivo/texto enviado' }, { status: 400 })
    }

    const resultado = await avaliarTranscricoes({
      tipo,
      transcricoes,
      operadorEmail: session.user.email ?? '',
      nomeArquivo,
    })
    return NextResponse.json(resultado)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha na avaliação' }, { status: 500 })
  }
}
