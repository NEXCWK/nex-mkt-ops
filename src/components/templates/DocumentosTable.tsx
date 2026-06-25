'use client'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { ExcluirTemplateButton } from '@/components/templates/ExcluirTemplateButton'
import { FileText, ArrowUp, ArrowDown, Download, Loader2 } from 'lucide-react'

const TH_CLASS = 'text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400'

type Doc = {
  id: string
  tipo: string
  nome: string
  unidade?: string | null
  versao?: number | null
  criado_por?: string | null
  created_at: string
}

export function DocumentosTable({ docs }: { docs: Doc[] }) {
  // Padrão: mais novo → mais antigo
  const [dir, setDir] = useState<'desc' | 'asc'>('desc')
  const [baixando, setBaixando] = useState<string | null>(null)

  async function baixar(tipo: string, nome: string) {
    if (baixando) return
    setBaixando(tipo)
    try {
      const res = await fetch(`/api/templates/baixar?tipo=${encodeURIComponent(tipo)}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? 'Não foi possível baixar o template.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const cd = res.headers.get('Content-Disposition')
      const m = cd?.match(/filename="([^"]+)"/)
      a.download = m?.[1] ?? `${tipo}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      alert('Erro ao baixar o template.')
    } finally {
      setBaixando(null)
    }
  }

  const ordenados = useMemo(() => {
    return [...docs].sort((a, b) => {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return dir === 'desc' ? tb - ta : ta - tb
    })
  }, [docs, dir])

  return (
    <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-nex-gray-50 border-b border-nex-gray-100">
            <tr>
              <th className={TH_CLASS}>Nome</th>
              <th className={TH_CLASS}>Tipo</th>
              <th className={TH_CLASS}>Unidade</th>
              <th className={TH_CLASS}>Versão</th>
              <th className={TH_CLASS}>Criado por</th>
              <th className={TH_CLASS}>
                <button
                  onClick={() => setDir(d => (d === 'desc' ? 'asc' : 'desc'))}
                  className="flex items-center gap-1 uppercase tracking-widest hover:text-nex-black transition-colors"
                  title={dir === 'desc' ? 'Mais novos primeiro (clique para inverter)' : 'Mais antigos primeiro (clique para inverter)'}
                >
                  Data
                  {dir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                </button>
              </th>
              <th className={TH_CLASS}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nex-gray-100">
            {ordenados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-14">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <FileText className="w-6 h-6 text-nex-gray-300" />
                    <p className="text-sm text-nex-gray-400">Nenhum template de documento cadastrado.</p>
                  </div>
                </td>
              </tr>
            )}
            {ordenados.map(t => (
              <tr key={t.id} className="hover:bg-nex-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium">
                  <button
                    onClick={() => baixar(t.tipo, t.nome)}
                    disabled={baixando === t.tipo}
                    className="inline-flex items-center gap-1.5 text-left hover:text-nex-black hover:underline disabled:opacity-50"
                    title="Baixar a versão .docx deste template"
                  >
                    {baixando === t.tipo
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin text-nex-gray-400 flex-shrink-0" />
                      : <FileText className="w-3.5 h-3.5 text-nex-gray-400 flex-shrink-0" />}
                    {t.nome}
                  </button>
                </td>
                <td className="px-4 py-3"><Badge variant="secondary">{t.tipo?.replace(/_/g, ' ')}</Badge></td>
                <td className="px-4 py-3">{t.unidade ?? '—'}</td>
                <td className="px-4 py-3"><Badge variant="yellow">v{t.versao}</Badge></td>
                <td className="px-4 py-3 text-nex-gray-500">{t.criado_por ?? '—'}</td>
                <td className="px-4 py-3 text-nex-gray-500 whitespace-nowrap">{formatDateTime(t.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => baixar(t.tipo, t.nome)}
                      disabled={baixando === t.tipo}
                      className="p-1.5 text-nex-gray-400 hover:text-nex-black hover:bg-nex-gray-100 rounded transition-colors disabled:opacity-50"
                      title="Baixar .docx"
                    >
                      {baixando === t.tipo
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Download className="w-4 h-4" />}
                    </button>
                    <ExcluirTemplateButton tipo={t.tipo} nome={t.nome} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
