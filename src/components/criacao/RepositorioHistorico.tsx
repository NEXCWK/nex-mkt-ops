'use client'

import { useEffect, useState } from 'react'
import { Loader2, Download, History } from 'lucide-react'

interface CriacaoRow {
  id: string
  produto: string | null
  vigencia: string | null
  desconto: string | null
  titulo: string | null
  descricao: string | null
  conteudo: Record<string, unknown>
  created_at: string
}

interface LpConteudo { html?: string; head?: string; body?: string; js?: string }
interface Slide { titulo: string; legenda: string; html: string }
interface CriativoConteudo { porFormato: Record<string, Slide[]> }

/** HTML completo da LP (novo formato tem .html; antigo compõe head/body/js). */
function lpHtml(c: LpConteudo): string {
  if (c.html) return c.html
  return `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n${c.head ?? ''}\n</head>\n<body>\n${c.body ?? ''}\n<script>${c.js ?? ''}</script>\n</body>\n</html>`
}

/** Injeta <base> para a prévia resolver ./styles.css contra /lp-assets/. */
function comBaseLp(html: string): string {
  return html.replace(/<head>/i, '<head>\n  <base href="/lp-assets/" />')
}

function baixarTexto(nome: string, texto: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([texto], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

export function RepositorioHistorico({ contexto }: { contexto: 'lp' | 'criativo' }) {
  const [itens, setItens] = useState<CriacaoRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/criacoes-historico?contexto=${contexto}`)
      .then(r => r.json())
      .then(json => setItens(json.criacoes ?? []))
      .finally(() => setLoading(false))
  }, [contexto])

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-10 text-nex-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Carregando repositório…</div>
  }

  if (itens.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-nex-gray-300 flex flex-col items-center gap-2">
        <History className="w-5 h-5 text-nex-gray-300" />
        Nenhuma {contexto === 'lp' ? 'landing page' : 'criativo'} salva no repositório ainda.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {itens.map(item => {
        const dataStr = new Date(item.created_at).toLocaleDateString('pt-BR')
        return (
          <div key={item.id} className="bg-white border border-nex-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div>
                <p className="text-sm font-heading font-semibold text-nex-gray-800">{item.titulo || item.produto || 'Sem título'}</p>
                <p className="text-[11px] text-nex-gray-400">
                  {dataStr}
                  {item.produto && ` · ${item.produto}`}
                  {item.vigencia && ` · Vigência: ${item.vigencia}`}
                  {item.desconto && ` · ${item.desconto}`}
                </p>
              </div>
              {contexto === 'lp' ? (
                <button
                  onClick={() => {
                    const c = item.conteudo as unknown as LpConteudo
                    baixarTexto(`lp-${item.id.slice(0, 8)}.html`, lpHtml(c), 'text/html;charset=utf-8')
                  }}
                  className="flex items-center gap-1.5 text-xs text-nex-gray-500 hover:text-nex-black"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar .html
                </button>
              ) : (
                <button
                  onClick={() => {
                    const c = item.conteudo as unknown as CriativoConteudo
                    const primeiro = Object.values(c.porFormato ?? {})[0]?.[0]
                    if (primeiro) baixarTexto(`criativo-${item.id.slice(0, 8)}.html`, primeiro.html, 'text/html;charset=utf-8')
                  }}
                  className="flex items-center gap-1.5 text-xs text-nex-gray-500 hover:text-nex-black"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar .html
                </button>
              )}
            </div>
            {contexto === 'lp' ? (
              <div className="rounded-lg overflow-hidden border border-nex-gray-100 h-40">
                <iframe
                  title={item.id}
                  srcDoc={comBaseLp(lpHtml(item.conteudo as unknown as LpConteudo))}
                  className="w-full h-full border-0 pointer-events-none"
                  sandbox=""
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {Object.entries((item.conteudo as unknown as CriativoConteudo).porFormato ?? {}).map(([formato, slides]) => (
                  <div key={formato} className="w-32">
                    <div className="rounded-lg overflow-hidden border border-nex-gray-100" style={{ aspectRatio: formato === 'retangulo' ? '4 / 5' : '1 / 1' }}>
                      <iframe title={`${item.id}-${formato}`} srcDoc={slides[0]?.html ?? ''} className="w-full h-full border-0 pointer-events-none" sandbox="" />
                    </div>
                    <p className="text-[10px] text-nex-gray-400 text-center mt-1 capitalize">{formato}</p>
                  </div>
                ))}
              </div>
            )}
            {item.descricao && <p className="text-xs text-nex-gray-500 mt-2">{item.descricao}</p>}
          </div>
        )
      })}
    </div>
  )
}
