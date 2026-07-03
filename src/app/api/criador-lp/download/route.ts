import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import PizZip from 'pizzip'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Empacota a LP gerada + todos os assets compartilhados (styles.css, fontes
 * Proxima Nova, logos) em um .zip portátil e autossuficiente.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { html, nome } = await req.json()
  if (!html) return NextResponse.json({ error: 'HTML ausente' }, { status: 400 })

  const nomeArquivo = (nome || 'landing-page').replace(/[^\w-]+/g, '-').toLowerCase()
  const assetsDir = resolve(process.cwd(), 'public', 'lp-assets')

  try {
    const zip = new PizZip()
    zip.file(`${nomeArquivo}.html`, html)
    zip.file('styles.css', readFileSync(resolve(assetsDir, 'styles.css')))
    zip.file('logo-nex-white.png', readFileSync(resolve(assetsDir, 'logo-nex-white.png')))
    zip.file('logo-nex-black.png', readFileSync(resolve(assetsDir, 'logo-nex-black.png')))

    const fontsDir = resolve(assetsDir, 'fonts')
    for (const f of readdirSync(fontsDir)) {
      if (f.endsWith('.otf')) zip.file(`fonts/${f}`, readFileSync(resolve(fontsDir, f)))
    }

    const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${nomeArquivo}.zip"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao gerar o pacote' }, { status: 500 })
  }
}
