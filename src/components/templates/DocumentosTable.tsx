'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { ExcluirTemplateButton } from '@/components/templates/ExcluirTemplateButton'
import { TIPOS_TEMPLATES_SISTEMA } from '@/lib/templates-sistema'
import { FileText, ArrowUp, ArrowDown, Download, Loader2, RefreshCw } from 'lucide-react'

const TH_CLASS = 'text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400'

type Doc = {
  id: string
  tipo: string
  nome: string
  unidade?: string | null
  versao?: number | null
  criado_por?: string | null
  created_at: string
  reimportado_em?: string | null
}

export function DocumentosTable({ docs, isAdmin }: { docs: Doc[]; isAdmin: boolean }) {
  const router = useRouter()
  // Padrão: mais novo → mais antigo
  const [dir, setDir] = useState<'desc' | 'asc'>('desc')
  const [baixando, setBaixando] = useState<string | null>(null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [reimportandoTipo, setReimportandoTipo] = useState<string | null>(null)
  const [reimportandoLote, setReimportandoLote] = useState(false)
  const [erroReimport, setErroReimport] = useState<string | null>(null)

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

  async function reimportar(tipos: string[]) {
    if (tipos.length === 0) return
    setErroReimport(null)
    try {
      const res = await fetch(`/api/admin/seed-templates?tipos=${encodeURIComponent(tipos.join(','))}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao reimportar')
      setSelecionados(new Set())
      router.refresh()
    } catch (e) {
      setErroReimport(e instanceof Error ? e.message : 'Erro ao reimportar')
    }
  }

  async function reimportarUm(tipo: string) {
    if (reimportandoTipo) return
    setReimportandoTipo(tipo)
    await reimportar([tipo])
    setReimportandoTipo(null)
  }

  async function reimportarSelecionados() {
    if (reimportandoLote || selecionados.size === 0) return
    setReimportandoLote(true)
    await reimportar(Array.from(selecionados))
    setReimportandoLote(false)
  }

  function alternarSelecao(tipo: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(tipo)) next.delete(tipo)
      else next.add(tipo)
      return next
    })
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
      {isAdmin && selecionados.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-nex-yellow/10 border-b border-nex-gray-100">
          <span className="text-xs text-nex-gray-600">{selecionados.size} template(s) selecionado(s)</span>
          <button
            onClick={reimportarSelecionados}
            disabled={reimportandoLote}
            className="flex items-center gap-1.5 text-xs font-heading font-medium bg-nex-black text-white px-3 py-1.5 rounded-md hover:bg-nex-gray-700 disabled:opacity-50 transition-colors"
          >
            {reimportandoLote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Reimportar selecionados
          </button>
          <button onClick={() => setSelecionados(new Set())} className="text-xs text-nex-gray-400 hover:text-nex-black">
            Limpar seleção
          </button>
        </div>
      )}
      {erroReimport && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 text-xs text-red-600">{erroReimport}</div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-nex-gray-50 border-b border-nex-gray-100">
            <tr>
              {isAdmin && <th className={TH_CLASS}></th>}
              <th className={TH_CLASS}>Nome</th>
              <th className={TH_CLASS}>Tipo</th>
              <th className={TH_CLASS}>Unidade</th>
              <th className={TH_CLASS}>Versão</th>
              <th className={TH_CLASS}>Criado por</th>
              <th className={TH_CLASS}>Últ. Reimportação</th>
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
                <td colSpan={9} className="px-4 py-14">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <FileText className="w-6 h-6 text-nex-gray-300" />
                    <p className="text-sm text-nex-gray-400">Nenhum template de documento cadastrado.</p>
                  </div>
                </td>
              </tr>
            )}
            {ordenados.map(t => {
              const ehTemplateSistema = TIPOS_TEMPLATES_SISTEMA.has(t.tipo)
              return (
              <tr key={t.id} className="hover:bg-nex-gray-50 transition-colors">
                {isAdmin && (
                  <td className="px-4 py-3">
                    {ehTemplateSistema && (
                      <input
                        type="checkbox"
                        checked={selecionados.has(t.tipo)}
                        onChange={() => alternarSelecao(t.tipo)}
                        title="Selecionar para reimportar"
                      />
                    )}
                  </td>
                )}
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
                <td className="px-4 py-3 text-nex-gray-500 whitespace-nowrap">
                  {t.reimportado_em ? formatDateTime(t.reimportado_em) : '—'}
                </td>
                <td className="px-4 py-3 text-nex-gray-500 whitespace-nowrap">{formatDateTime(t.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {isAdmin && ehTemplateSistema && (
                      <button
                        onClick={() => reimportarUm(t.tipo)}
                        disabled={reimportandoTipo === t.tipo}
                        className="p-1.5 text-nex-gray-400 hover:text-nex-black hover:bg-nex-gray-100 rounded transition-colors disabled:opacity-50"
                        title="Reimportar só este template do repositório"
                      >
                        {reimportandoTipo === t.tipo
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <RefreshCw className="w-4 h-4" />}
                      </button>
                    )}
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
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
