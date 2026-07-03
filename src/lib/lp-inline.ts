/**
 * Torna uma LP gerada AUTOSSUFICIENTE: embute o styles.css (com as fontes
 * Proxima Nova em base64) e os logos em base64, para o arquivo .html funcionar
 * sozinho ao ser aberto direto no navegador, sem arquivos irmãos.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

function assetsDir() {
  return resolve(process.cwd(), 'public', 'lp-assets')
}

function dataUri(caminho: string, mime: string): string {
  const b64 = readFileSync(caminho).toString('base64')
  return `data:${mime};base64,${b64}`
}

export function inlineLP(html: string): string {
  const dir = assetsDir()

  // 1. Lê o CSS e substitui as fontes ./fonts/*.otf por data URIs
  let css = readFileSync(resolve(dir, 'styles.css'), 'utf-8')
  css = css.replace(/url\(["']?\.\/fonts\/([^"')]+)["']?\)/g, (_m, arquivo: string) => {
    try {
      return `url(${dataUri(resolve(dir, 'fonts', arquivo), 'font/otf')})`
    } catch {
      return _m
    }
  })

  // 2. Inline do CSS no lugar do <link rel="stylesheet" href="./styles.css" />
  let out = html.replace(
    /<link\s+rel=["']stylesheet["']\s+href=["']\.\/styles\.css["']\s*\/?>/i,
    `<style>\n${css}\n</style>`
  )

  // 3. Logos em base64
  const logoWhite = (() => { try { return dataUri(resolve(dir, 'logo-nex-white.png'), 'image/png') } catch { return '' } })()
  const logoBlack = (() => { try { return dataUri(resolve(dir, 'logo-nex-black.png'), 'image/png') } catch { return '' } })()
  if (logoWhite) out = out.split('./logo-nex-white.png').join(logoWhite)
  if (logoBlack) out = out.split('./logo-nex-black.png').join(logoBlack)

  return out
}
