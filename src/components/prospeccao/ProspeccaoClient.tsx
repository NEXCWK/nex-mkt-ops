'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Sparkles, Send, Search, Trash2, Mail, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Empresa {
  empresa: string
  contato: string
  email: string
  telefone: string
  site: string
  segmento: string
  regiao: string
  observacao: string
  selecionada: boolean
}

interface Props {
  tipo: 'bdr' | 'parcerias'
  titulo: string
  descricao: string
  nichoLabel: string
  nichoPlaceholder: string
}

function aplicarVariaveis(texto: string, e: Empresa): string {
  return texto
    .replace(/\{\{\s*nome\s*\}\}/gi, e.contato || 'responsável')
    .replace(/\{\{\s*empresa\s*\}\}/gi, e.empresa || '')
}

export function ProspeccaoClient({ tipo, titulo, descricao, nichoLabel, nichoPlaceholder }: Props) {
  const [regiao, setRegiao] = useState('Curitiba e região metropolitana')
  const [nicho, setNicho] = useState('')
  const [quantidade, setQuantidade] = useState(15)
  const [loadingGerar, setLoadingGerar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [statusEnvio, setStatusEnvio] = useState<string | null>(null)

  async function gerar() {
    if (!nicho.trim() || loadingGerar) return
    setLoadingGerar(true)
    setErro(null)
    try {
      const res = await fetch('/api/prospeccao/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, regiao, nicho, quantidade }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setEmpresas((json.empresas ?? []).map((e: Omit<Empresa, 'selecionada'>) => ({ ...e, selecionada: true })))
      if (json.emailTemplate) {
        setAssunto(json.emailTemplate.assunto ?? '')
        setCorpo(json.emailTemplate.corpo ?? '')
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar lista')
    } finally {
      setLoadingGerar(false)
    }
  }

  function update(i: number, patch: Partial<Empresa>) {
    setEmpresas(prev => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  }

  const selecionadas = empresas.filter(e => e.selecionada && e.email.trim())

  async function enviar() {
    if (selecionadas.length === 0 || !assunto.trim() || !corpo.trim() || enviando) return
    setEnviando(true)
    setStatusEnvio(null)
    try {
      const res = await fetch('/api/prospeccao/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assunto,
          corpo,
          destinatarios: selecionadas.map(e => ({ email: e.email, nome: e.contato, empresa: e.empresa })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setStatusEnvio(`Enviados: ${json.enviados ?? 0} · Falhas: ${json.falhas ?? 0}`)
    } catch (e) {
      setStatusEnvio(e instanceof Error ? e.message : 'Falha no envio')
    } finally {
      setEnviando(false)
    }
  }

  const preview = selecionadas[0]

  return (
    <div>
      <PageHeader title={titulo} description={descricao} />

      {/* 1. Critérios de busca */}
      <div className="bg-white border border-nex-gray-200 rounded-xl p-5 mb-5">
        <h3 className="text-sm font-heading font-semibold text-nex-black mb-3 flex items-center gap-1.5">
          <Search className="w-4 h-4 text-nex-gray-400" /> Critérios de prospecção
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Região</label>
            <input value={regiao} onChange={e => setRegiao(e.target.value)}
              className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          </div>
          <div>
            <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">{nichoLabel}</label>
            <input value={nicho} onChange={e => setNicho(e.target.value)} placeholder={nichoPlaceholder}
              className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          </div>
          <div>
            <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Quantidade</label>
            <input type="number" min={1} max={40} value={quantidade} onChange={e => setQuantidade(Number(e.target.value))}
              className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          </div>
        </div>
        {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}
        <button onClick={gerar} disabled={!nicho.trim() || loadingGerar}
          className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors">
          {loadingGerar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loadingGerar ? 'Buscando empresas…' : 'Gerar lista de empresas'}
        </button>
        <p className="text-[11px] text-nex-gray-300 mt-2">
          A lista é gerada por IA a partir de conhecimento de mercado e dados públicos (Google, bases públicas e APIs gratuitas do Brasil).
          Valide e-mails e contatos antes do envio — registros podem precisar de conferência.
        </p>
      </div>

      {/* 2. Lista de empresas */}
      {empresas.length > 0 && (
        <div className="bg-white border border-nex-gray-200 rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-heading font-semibold text-nex-black">
              Empresas encontradas ({empresas.length}) · {selecionadas.length} selecionada(s) com e-mail
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-nex-gray-400 border-b border-nex-gray-100">
                  <th className="py-2 pr-2 w-8"></th>
                  <th className="py-2 pr-2">Empresa</th>
                  <th className="py-2 pr-2">Contato</th>
                  <th className="py-2 pr-2">E-mail</th>
                  <th className="py-2 pr-2">Segmento</th>
                  <th className="py-2 pr-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e, i) => (
                  <tr key={i} className="border-b border-nex-gray-50 align-top">
                    <td className="py-2 pr-2">
                      <input type="checkbox" checked={e.selecionada} onChange={ev => update(i, { selecionada: ev.target.checked })} />
                    </td>
                    <td className="py-2 pr-2">
                      <div className="font-heading font-medium text-nex-gray-800">{e.empresa}</div>
                      <div className="text-[11px] text-nex-gray-400">{e.regiao} {e.site && `· ${e.site}`}</div>
                    </td>
                    <td className="py-2 pr-2 text-nex-gray-600">{e.contato || '—'}</td>
                    <td className="py-2 pr-2">
                      <input value={e.email} onChange={ev => update(i, { email: ev.target.value })} placeholder="email@empresa.com"
                        className="w-44 rounded border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                    </td>
                    <td className="py-2 pr-2 text-nex-gray-500 text-xs">{e.segmento}</td>
                    <td className="py-2">
                      <button onClick={() => setEmpresas(prev => prev.filter((_, idx) => idx !== i))} className="text-nex-gray-300 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. E-mail */}
      {empresas.length > 0 && (
        <div className="bg-white border border-nex-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-heading font-semibold text-nex-black mb-3 flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-nex-gray-400" /> E-mail de prospecção
          </h3>
          <p className="text-[11px] text-nex-gray-400 mb-3">
            Use as variáveis <code className="px-1 bg-nex-gray-100 rounded">{'{{nome}}'}</code> e{' '}
            <code className="px-1 bg-nex-gray-100 rounded">{'{{empresa}}'}</code>. Envio via <strong>comercial@nexcoworking.com.br</strong>.
          </p>
          <input value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Assunto do e-mail"
            className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          <textarea value={corpo} onChange={e => setCorpo(e.target.value)} rows={10} placeholder="Olá {{nome}}, tudo bem? Notamos que a {{empresa}}…"
            className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />

          {preview && (
            <div className="mt-3 p-3 rounded-lg bg-nex-gray-50 border border-nex-gray-100">
              <p className="text-[11px] uppercase tracking-wide text-nex-gray-400 mb-1">Prévia ({preview.empresa})</p>
              <p className="text-sm font-heading font-medium text-nex-gray-800 mb-1">{aplicarVariaveis(assunto, preview)}</p>
              <p className="text-sm text-nex-gray-600 whitespace-pre-wrap">{aplicarVariaveis(corpo, preview)}</p>
            </div>
          )}

          <div className="flex items-center gap-3 mt-4">
            <button onClick={enviar} disabled={selecionadas.length === 0 || !assunto.trim() || !corpo.trim() || enviando}
              className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading font-medium transition-colors',
                'bg-nex-black text-white hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none')}>
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {enviando ? 'Enviando…' : `Enviar para ${selecionadas.length} empresa(s)`}
            </button>
            {statusEnvio && <span className="text-sm text-nex-gray-600">{statusEnvio}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
