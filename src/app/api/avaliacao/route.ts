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

  const contentType = req.headers.get('content-type') ?? ''
  let tipo: 'atendimento' | 'telefonema' = 'atendimento'
  let transcricoes = ''
  let nomeArquivo: string | null = null

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    tipo = (String(form.get('tipo') ?? 'atendimento') as 'atendimento' | 'telefonema')
    const file = form.get('arquivo') as File | null
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer())
      nomeArquivo = file.name
      if (isAudioFile(file.name)) {
        // Ligação em áudio: transcreve para texto antes de avaliar
        try {
          const texto = await transcreverAudio(buffer, file.name)
          const atendente = String(form.get('atendente') ?? '').trim()
          transcricoes = atendente
            ? `[Atendente: ${atendente}]\n${texto}`
            : texto
        } catch (e) {
          return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao transcrever o áudio' }, { status: 400 })
        }
      } else {
        transcricoes = await extrairTextoDeArquivo(buffer, file.name)
      }
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

  try {
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
