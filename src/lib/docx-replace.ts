/**
 * Substituição de texto em document.xml de .docx tolerante à fragmentação do Word.
 *
 * O Word quebra um mesmo texto visível em vários <w:r><w:t>…</w:t></w:r> (runs),
 * insere <w:tab/>/<w:br/> entre eles e escapa caracteres como entidades XML
 * (&amp;, &lt;…). Um replace por string exata falha nesses casos.
 *
 * A estratégia aqui: montar uma sequência de "células" — uma por caractere lógico
 * visível — onde cada célula sabe sua posição exata no XML (para texto real) ou é um
 * espaço virtual (para <w:tab/>, <w:br/>, quebras). Assim conseguimos localizar um
 * trecho mesmo que ele atravesse vários runs / tabs / entidades, e reescrever apenas
 * os pedaços de texto real, preservando toda a formatação.
 */

const ENTIDADES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
}

type Celula = { ch: string; xmlStart: number; xmlLen: number; real: boolean }

function montarCelulas(xml: string): Celula[] {
  const celulas: Celula[] = []
  // Em ordem do documento: elementos estruturais de espaço OU blocos <w:t>…</w:t>.
  // Os estruturais vêm primeiro e o <w:t> exige ">" ou espaço logo após "w:t",
  // para NÃO casar acidentalmente com <w:tab/>.
  const tokenRe = /<w:tab\s*\/>|<w:br\s*\/>|<w:cr\s*\/>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(xml))) {
    if (m[1] === undefined) {
      // <w:tab/>, <w:br/>, <w:cr/> → espaço virtual (não editável)
      celulas.push({ ch: ' ', xmlStart: m.index, xmlLen: 0, real: false })
      continue
    }
    const inner = m[1]
    const innerStart = m.index + m[0].indexOf('>') + 1
    let i = 0
    let xmlPos = innerStart
    while (i < inner.length) {
      if (inner[i] === '&') {
        const sc = inner.indexOf(';', i)
        const ent = sc !== -1 ? inner.slice(i, sc + 1) : ''
        if (ent && ENTIDADES[ent]) {
          celulas.push({ ch: ENTIDADES[ent], xmlStart: xmlPos, xmlLen: ent.length, real: true })
          xmlPos += ent.length
          i += ent.length
          continue
        }
      }
      celulas.push({ ch: inner[i], xmlStart: xmlPos, xmlLen: 1, real: true })
      xmlPos += 1
      i += 1
    }
  }
  return celulas
}

function escaparXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function replaceAcrossRuns(xml: string, original: string, replacement: string): string | null {
  const celulas = montarCelulas(xml)
  if (celulas.length === 0) return null

  // Normaliza espaços, mantendo mapa norm→indiceDaCelula
  let norm = ''
  const normToCell: number[] = []
  let prevSpace = false
  for (let c = 0; c < celulas.length; c++) {
    const ch = celulas[c].ch
    if (/\s/.test(ch)) {
      if (prevSpace) continue
      norm += ' '
      normToCell.push(c)
      prevSpace = true
    } else {
      norm += ch
      normToCell.push(c)
      prevSpace = false
    }
  }

  const alvo = original.replace(/\s+/g, ' ').trim()
  if (!alvo) return null
  const idx = norm.indexOf(alvo)
  if (idx === -1) return null

  const cellStart = normToCell[idx]
  const cellEnd = normToCell[idx + alvo.length - 1]

  // Coleta as células de texto REAL no intervalo casado
  const reais: Celula[] = []
  for (let c = cellStart; c <= cellEnd; c++) {
    if (celulas[c].real) reais.push(celulas[c])
  }
  if (reais.length === 0) return null

  // Edits: primeira célula real recebe a substituição; as demais são apagadas
  const repEscaped = escaparXml(replacement)
  const edits = reais.map((cel, k) => ({
    start: cel.xmlStart,
    end: cel.xmlStart + cel.xmlLen,
    newText: k === 0 ? repEscaped : '',
  }))

  let out = xml
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.newText + out.slice(e.end)
  }
  return out
}

/** Extrai a porção entre o primeiro "[" e o último "]" (placeholders no formato antigo). */
function porcaoColchetes(s: string): string | null {
  const a = s.indexOf('[')
  const b = s.lastIndexOf(']')
  if (a !== -1 && b > a) return s.slice(a, b + 1)
  return null
}

/**
 * Aplica uma substituição com várias estratégias, da mais específica à mais tolerante:
 * 1) match exato da string completa;
 * 2) match tolerante a fragmentação da string completa;
 * 3) se o trecho contém placeholder(s) [ASSIM], tenta casar só a porção entre colchetes
 *    (exato e tolerante) — resolve o caso comum em que a IA devolve "Rótulo: [TOKEN]".
 */
export function aplicarSubstituicao(
  xml: string,
  original: string,
  replacement: string
): { xml: string; aplicou: boolean } {
  if (xml.includes(original)) {
    return { xml: xml.split(original).join(replacement), aplicou: true }
  }
  const frag = replaceAcrossRuns(xml, original, replacement)
  if (frag) return { xml: frag, aplicou: true }

  const colchetes = porcaoColchetes(original)
  if (colchetes && colchetes !== original) {
    if (xml.includes(colchetes)) {
      return { xml: xml.split(colchetes).join(replacement), aplicou: true }
    }
    const fragC = replaceAcrossRuns(xml, colchetes, replacement)
    if (fragC) return { xml: fragC, aplicou: true }
  }

  return { xml, aplicou: false }
}
