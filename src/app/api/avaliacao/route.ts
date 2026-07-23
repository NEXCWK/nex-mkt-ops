import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { assertApiKey } from '@/lib/anthropic'
import { podeAcessarDashboardAvaliacao } from '@/lib/acesso-restrito'
import { extrairTextoDeArquivo } from '@/lib/parse-transcricoes'
import { isAudioFile, transcreverAudio } from '@/lib/transcricao-audio'
import { avaliarTranscricoes, comConcorrenciaLimitada, type ItemParaAvaliar } from '@/lib/avaliacao-core'

/** Chamadas simultâneas à API de transcrição (OpenAI) — mantém lotes de várias ligações dentro do tempo de uma requisição HTTP. */
const CONCORRENCIA_TRANSCRICAO = 4

export const dynamic = 'force-dynamic'
// Lotes grandes (dezenas de arquivos) processam em paralelo, mas com margem extra
// de tempo para picos de latência da IA ou rate limiting sob carga.
export const maxDuration = 600

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
    const itens: ItemParaAvaliar[] = []

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      tipo = (String(form.get('tipo') ?? 'atendimento') as 'atendimento' | 'telefonema')
      const files = form.getAll('arquivo').filter((f): f is File => f instanceof File)
      if (files.length > 0) {
        const atendente = String(form.get('atendente') ?? '').trim()

        // Cada arquivo é processado isoladamente e em paralelo (com concorrência limitada) — a falha
        // de UM arquivo (ex.: uma ligação com áudio corrompido) não deve derrubar o lote inteiro nem
        // descartar os demais já transcritos/lidos com sucesso; ela vira uma conversa-fallback isolada
        // (mesmo padrão de isolamento de falhas usado na avaliação via IA em avaliacao-core.ts).
        const itensPorArquivo = await comConcorrenciaLimitada(files, CONCORRENCIA_TRANSCRICAO, async (file): Promise<ItemParaAvaliar> => {
          const buffer = Buffer.from(await file.arrayBuffer())
          const ext = file.name.toLowerCase().split('.').pop() ?? ''
          if (isAudioFile(file.name)) {
            // Ligação em áudio: transcreve para texto antes de avaliar
            try {
              const texto = await transcreverAudio(buffer, file.name)
              return { nomeArquivo: file.name, texto: atendente ? `[Atendente: ${atendente}]\n${texto}` : texto }
            } catch (e) {
              return { nomeArquivo: file.name, erro: e instanceof Error ? e.message : 'Falha ao transcrever o áudio' }
            }
          } else if (ext === 'pdf') {
            // PDF nativo: enviado direto à IA (lida com PDFs de imagem/scan — ver avaliacao-core.ts)
            return { nomeArquivo: file.name, pdfBase64: buffer.toString('base64') }
          } else {
            try {
              const texto = await extrairTextoDeArquivo(buffer, file.name)
              return { nomeArquivo: file.name, texto }
            } catch (e) {
              return { nomeArquivo: file.name, erro: `Falha ao ler o arquivo: ${e instanceof Error ? e.message : 'formato inválido ou corrompido'}` }
            }
          }
        })
        itens.push(...itensPorArquivo)
      } else {
        const transcricoes = String(form.get('transcricoes') ?? '')
        if (transcricoes.trim()) itens.push({ nomeArquivo: 'Texto colado', texto: transcricoes })
      }
    } else {
      const body = await req.json()
      tipo = body.tipo ?? 'atendimento'
      const transcricoes = String(body.transcricoes ?? '')
      if (transcricoes.trim()) itens.push({ nomeArquivo: 'Texto colado', texto: transcricoes })
    }

    if (itens.length === 0) {
      return NextResponse.json({ error: 'Nenhuma transcrição encontrada no arquivo/texto enviado' }, { status: 400 })
    }

    const resultado = await avaliarTranscricoes({
      tipo,
      itens,
      operadorEmail: session.user.email ?? '',
    })

    // Notas, KPIs e análises são restritos ao dashboard (ver acesso-restrito.ts) —
    // quem enviou mas não tem acesso ao dashboard recebe só a confirmação do envio.
    if (!podeAcessarDashboardAvaliacao(session.user.email)) {
      return NextResponse.json({ totalConversas: resultado.totalConversas })
    }

    return NextResponse.json(resultado)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha na avaliação' }, { status: 500 })
  }
}
