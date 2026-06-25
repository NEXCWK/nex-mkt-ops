import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import PizZip from 'pizzip'

export const maxDuration = 120

function textoDoXML(xml: string): string {
  const matches = [...xml.matchAll(/<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>/g)]
  return matches.map(m => m[1]).join(' ')
}

/** Normaliza o texto para comparar ESTRUTURA + TEXTO fixo, ignorando os dados variáveis. */
function normalizar(texto: string): string {
  return texto
    .replace(/\{\{[^}]*\}\}/g, ' ')   // remove marcadores {{token}}
    .replace(/\[[^\]]*\]/g, ' ')       // remove placeholders [CHAVE]
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[0-9]+/g, ' ')           // remove números (valores, datas)
    .replace(/[^a-z\s]/g, ' ')         // só letras
    .replace(/\s+/g, ' ')
    .trim()
}

/** Conjunto de shingles (trigramas de palavras) — captura estrutura e texto. */
function shingles(texto: string, n = 3): Set<string> {
  const palavras = texto.split(' ').filter(Boolean)
  const set = new Set<string>()
  if (palavras.length < n) {
    palavras.forEach(p => set.add(p))
    return set
  }
  for (let i = 0; i <= palavras.length - n; i++) {
    set.add(palavras.slice(i, i + n).join(' '))
  }
  return set
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  a.forEach(s => { if (b.has(s)) inter++ })
  return inter / (a.size + b.size - inter)
}

function textoDeDocx(buf: Buffer): string {
  try {
    const zip = new PizZip(buf)
    const xml = zip.file('word/document.xml')?.asText()
    return xml ? textoDoXML(xml) : ''
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !['gestor', 'admin'].includes(session.user.perfil ?? '')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { docxBase64 } = await req.json()
  if (!docxBase64) return NextResponse.json({ error: 'Envie docxBase64' }, { status: 400 })

  const textoNovo = normalizar(textoDeDocx(Buffer.from(docxBase64, 'base64')))
  if (!textoNovo) return NextResponse.json({ scores: [] })
  const shinglesNovo = shingles(textoNovo)

  const supabase = createServerClient()
  const { data } = await supabase
    .from('templates_documentos')
    .select('tipo, nome, versao, arquivo_url')
    .not('arquivo_url', 'is', null)
    .order('versao', { ascending: false })

  // Versão mais recente por tipo
  const porTipo = new Map<string, { tipo: string; nome: string; versao: number; arquivo_url: string }>()
  for (const t of data ?? []) {
    if (!porTipo.has(t.tipo) && t.arquivo_url) {
      porTipo.set(t.tipo, { tipo: t.tipo, nome: t.nome, versao: t.versao ?? 1, arquivo_url: t.arquivo_url })
    }
  }

  const scores: Array<{ tipo: string; nome: string; versao: number; score: number }> = []
  await Promise.all([...porTipo.values()].map(async t => {
    const { data: file } = await supabase.storage.from('templates').download(t.arquivo_url)
    if (!file) return
    const txt = normalizar(textoDeDocx(Buffer.from(await file.arrayBuffer())))
    const score = jaccard(shinglesNovo, shingles(txt))
    scores.push({ tipo: t.tipo, nome: t.nome, versao: t.versao, score })
  }))

  scores.sort((a, b) => b.score - a.score)
  return NextResponse.json({ scores })
}
