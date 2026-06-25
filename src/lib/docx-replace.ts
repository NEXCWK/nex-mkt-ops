/**
 * Substituição de texto em document.xml de .docx tolerante à fragmentação do Word.
 *
 * O Word quebra um mesmo texto visível em vários <w:r><w:t>…</w:t></w:r> (runs)
 * por causa de formatação interna. Um replace por string exata falha nesses casos.
 * `replaceAcrossRuns` concatena o texto de todos os <w:t>, localiza o trecho mesmo
 * que ele atravesse vários runs (ignorando diferenças de espaço em branco) e aplica
 * a substituição reescrevendo apenas os runs afetados, preservando a formatação.
 */
export function replaceAcrossRuns(xml: string, original: string, replacement: string): string | null {
  const runRe = /(<w:t[^>]*>)([\s\S]*?)(<\/w:t>)/g
  const runs: { text: string; textStart: number }[] = []
  let m: RegExpExecArray | null
  while ((m = runRe.exec(xml))) {
    runs.push({ text: m[2], textStart: m.index + m[1].length })
  }
  if (runs.length === 0) return null

  let concat = ''
  const charRun: number[] = []
  const charOff: number[] = []
  runs.forEach((r, ri) => {
    for (let i = 0; i < r.text.length; i++) {
      concat += r.text[i]
      charRun.push(ri)
      charOff.push(i)
    }
  })

  let norm = ''
  const normToConcat: number[] = []
  let prevSpace = false
  for (let i = 0; i < concat.length; i++) {
    const ch = concat[i]
    if (/\s/.test(ch)) {
      if (prevSpace) continue
      norm += ' '
      normToConcat.push(i)
      prevSpace = true
    } else {
      norm += ch
      normToConcat.push(i)
      prevSpace = false
    }
  }

  const alvo = original.replace(/\s+/g, ' ').trim()
  if (!alvo) return null
  const idx = norm.indexOf(alvo)
  if (idx === -1) return null

  const concatStart = normToConcat[idx]
  const concatEnd = normToConcat[idx + alvo.length - 1]
  const startRun = charRun[concatStart]
  const startOff = charOff[concatStart]
  const endRun = charRun[concatEnd]
  const endOff = charOff[concatEnd]

  const edits: { start: number; end: number; newText: string }[] = []
  for (let ri = startRun; ri <= endRun; ri++) {
    const r = runs[ri]
    let nt: string
    if (ri === startRun && ri === endRun) nt = r.text.slice(0, startOff) + replacement + r.text.slice(endOff + 1)
    else if (ri === startRun) nt = r.text.slice(0, startOff) + replacement
    else if (ri === endRun) nt = r.text.slice(endOff + 1)
    else nt = ''
    edits.push({ start: r.textStart, end: r.textStart + r.text.length, newText: nt })
  }

  let out = xml
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.newText + out.slice(e.end)
  }
  return out
}

/**
 * Aplica uma substituição tentando primeiro match exato e, em seguida,
 * o match tolerante a fragmentação. Retorna o XML novo + se aplicou.
 */
export function aplicarSubstituicao(
  xml: string,
  original: string,
  replacement: string
): { xml: string; aplicou: boolean } {
  if (xml.includes(original)) {
    return { xml: xml.split(original).join(replacement), aplicou: true }
  }
  const novo = replaceAcrossRuns(xml, original, replacement)
  if (novo) return { xml: novo, aplicou: true }
  return { xml, aplicou: false }
}
