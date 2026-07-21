'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Sparkles, Send, Search, Trash2, Mail, Loader2, Users, User, Check, Save, FolderOpen, Download, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Empresa {
  empresa: string
  contato: string
  email: string
  emailSecundario: string
  telefone: string
  site: string
  segmento: string
  regiao: string
  observacao: string
  selecionada: boolean
}

const PRODUTOS_BDR = ['Salas de Reunião', 'Escritório Privativo', 'Diárias de Trabalho em Escritório']
const PRODUTO_PARCERIAS = 'Escritório Virtual — Endereço Fiscal (indicação)'

interface ListaSalva {
  id: string
  nome: string
  regiao: string | null
  nicho: string | null
  produto: string | null
  empresas: Omit<Empresa, 'selecionada'>[]
  assunto: string | null
  corpo: string | null
  created_at: string
}

function csvDaLista(empresas: Omit<Empresa, 'selecionada'>[]): string {
  const cols = ['empresa', 'contato', 'email', 'emailSecundario', 'telefone', 'site', 'segmento', 'regiao', 'observacao']
  const linhas = [cols.join(',')]
  for (const e of empresas) {
    linhas.push(cols.map(c => `"${String((e as Record<string, unknown>)[c] ?? '').replace(/"/g, '""')}"`).join(','))
  }
  return linhas.join('\n')
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
  const [aba, setAba] = useState<'gerar' | 'salvas'>('gerar')

  const [regiao, setRegiao] = useState('Curitiba e região metropolitana')
  const [nicho, setNicho] = useState('')
  const [quantidade, setQuantidade] = useState(15)
  const [produto, setProduto] = useState(tipo === 'bdr' ? PRODUTOS_BDR[0] : PRODUTO_PARCERIAS)
  const [loadingGerar, setLoadingGerar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')

  // Listas salvas
  const [listasSalvas, setListasSalvas] = useState<ListaSalva[]>([])
  const [carregandoListas, setCarregandoListas] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [nomeParaSalvar, setNomeParaSalvar] = useState('')
  const [mostrarSalvar, setMostrarSalvar] = useState(false)

  async function carregarListasSalvas() {
    setCarregandoListas(true)
    try {
      const res = await fetch(`/api/prospeccao/listas?tipo=${tipo}`)
      const json = await res.json()
      setListasSalvas(json.listas ?? [])
    } catch {
      setListasSalvas([])
    } finally {
      setCarregandoListas(false)
    }
  }

  useEffect(() => { if (aba === 'salvas') carregarListasSalvas() }, [aba]) // eslint-disable-line react-hooks/exhaustive-deps

  async function salvarLista() {
    if (empresas.length === 0 || !nomeParaSalvar.trim() || salvando) return
    setSalvando(true)
    try {
      const res = await fetch('/api/prospeccao/listas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo, nome: nomeParaSalvar.trim(), regiao, nicho, produto,
          empresas: empresas.map(({ selecionada: _selecionada, ...e }) => e),
          assunto, corpo,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setMostrarSalvar(false)
      setNomeParaSalvar('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar a lista')
    } finally {
      setSalvando(false)
    }
  }

  function carregarLista(lista: ListaSalva) {
    setEmpresas(lista.empresas.map(e => ({ ...e, emailSecundario: e.emailSecundario ?? '', selecionada: true })))
    setAssunto(lista.assunto ?? '')
    setCorpo(lista.corpo ?? '')
    if (lista.regiao) setRegiao(lista.regiao)
    if (lista.nicho) setNicho(lista.nicho)
    if (lista.produto) setProduto(lista.produto)
    setAba('gerar')
  }

  function exportarCsv(lista: ListaSalva) {
    const csv = csvDaLista(lista.empresas)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${lista.nome.replace(/[^\w-]+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function excluirLista(id: string) {
    try {
      await fetch(`/api/prospeccao/listas?id=${id}`, { method: 'DELETE' })
      setListasSalvas(prev => prev.filter(l => l.id !== id))
    } catch { /* silent */ }
  }

  const [modoEnvio, setModoEnvio] = useState<'massa' | 'individual'>('massa')
  const [enviando, setEnviando] = useState(false)
  const [statusEnvio, setStatusEnvio] = useState<string | null>(null)

  // Envio individual: índice em edição e conjunto de já enviados
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null)
  const [textoIndividual, setTextoIndividual] = useState({ assunto: '', corpo: '' })
  const [enviadosIdx, setEnviadosIdx] = useState<Set<number>>(new Set())
  const [enviandoIdx, setEnviandoIdx] = useState<number | null>(null)

  async function gerar() {
    if (!nicho.trim() || loadingGerar) return
    setLoadingGerar(true)
    setErro(null)
    try {
      const res = await fetch('/api/prospeccao/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, regiao, nicho, quantidade, produto }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setEmpresas((json.empresas ?? []).map((e: Omit<Empresa, 'selecionada'>) => ({ ...e, emailSecundario: e.emailSecundario ?? '', selecionada: true })))
      if (json.emailTemplate) {
        setAssunto(json.emailTemplate.assunto ?? '')
        setCorpo(json.emailTemplate.corpo ?? '')
      }
      setEnviadosIdx(new Set())
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
  const totalEmailsMassa = selecionadas.reduce((s, e) => s + (e.email.trim() ? 1 : 0) + (e.emailSecundario?.trim() ? 1 : 0), 0)

  async function enviarMassa() {
    if (selecionadas.length === 0 || !assunto.trim() || !corpo.trim() || enviando) return
    setEnviando(true)
    setStatusEnvio(null)
    try {
      const res = await fetch('/api/prospeccao/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          assunto,
          corpo,
          destinatarios: selecionadas.map(e => ({ email: e.email, emailSecundario: e.emailSecundario, nome: e.contato, empresa: e.empresa })),
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

  function abrirEdicaoIndividual(i: number) {
    const e = empresas[i]
    setEditandoIdx(i)
    setTextoIndividual({ assunto: aplicarVariaveis(assunto, e), corpo: aplicarVariaveis(corpo, e) })
  }

  async function enviarIndividual(i: number) {
    const e = empresas[i]
    if (!e.email.trim() || !textoIndividual.assunto.trim() || !textoIndividual.corpo.trim()) return
    setEnviandoIdx(i)
    try {
      const res = await fetch('/api/prospeccao/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          assunto: textoIndividual.assunto,
          corpo: textoIndividual.corpo,
          destinatarios: [{ email: e.email, emailSecundario: e.emailSecundario, nome: e.contato, empresa: e.empresa }],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setEnviadosIdx(prev => new Set(prev).add(i))
      setEditandoIdx(null)
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : 'Falha ao enviar este e-mail')
    } finally {
      setEnviandoIdx(null)
    }
  }

  const preview = selecionadas[0]

  return (
    <div>
      <PageHeader title={titulo} description={descricao} />

      {/* Tabs: Gerar Nova Lista / Listas Salvas */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setAba('gerar')}
          className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-heading font-medium border transition-colors',
            aba === 'gerar' ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
          <Sparkles className="w-3.5 h-3.5" /> Gerar Nova Lista
        </button>
        <button onClick={() => setAba('salvas')}
          className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-heading font-medium border transition-colors',
            aba === 'salvas' ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
          <FolderOpen className="w-3.5 h-3.5" /> Listas Salvas
        </button>
      </div>

      {aba === 'salvas' ? (
        <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
          <div className="border-b border-nex-gray-100 px-5 py-3 flex items-center justify-between">
            <span className="text-xs font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Listas Salvas</span>
            {carregandoListas && <Loader2 className="w-3.5 h-3.5 animate-spin text-nex-gray-300" />}
          </div>
          {listasSalvas.length === 0 ? (
            <div className="py-10 text-center text-sm text-nex-gray-300">
              {carregandoListas ? 'Carregando…' : 'Nenhuma lista salva ainda. Gere e salve uma lista na aba "Gerar Nova Lista".'}
            </div>
          ) : (
            <div className="divide-y divide-nex-gray-50">
              {listasSalvas.map(l => (
                <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-nex-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-heading font-medium text-nex-gray-800">{l.nome}</p>
                    <p className="text-[11px] text-nex-gray-400">
                      {l.empresas.length} empresa(s) · {l.produto ?? l.nicho ?? '—'} · {new Date(l.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <button onClick={() => carregarLista(l)} className="flex items-center gap-1 text-xs text-nex-gray-500 hover:text-nex-black">
                      <Upload className="w-3.5 h-3.5" /> Carregar
                    </button>
                    <button onClick={() => exportarCsv(l)} className="flex items-center gap-1 text-xs text-nex-gray-500 hover:text-nex-black">
                      <Download className="w-3.5 h-3.5" /> Exportar CSV
                    </button>
                    <button onClick={() => excluirLista(l.id)} className="text-nex-gray-300 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
      <>
      {/* 1. Critérios de busca */}
      <div className="bg-white border border-nex-gray-200 rounded-xl p-5 mb-5">
        <h3 className="text-sm font-heading font-semibold text-nex-black mb-3 flex items-center gap-1.5">
          <Search className="w-4 h-4 text-nex-gray-400" /> Critérios de prospecção
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
          <div>
            <label className="text-xs font-heading font-medium text-nex-gray-500 block mb-1">Produto de interesse</label>
            {tipo === 'bdr' ? (
              <select value={produto} onChange={e => setProduto(e.target.value)}
                className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400">
                {PRODUTOS_BDR.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <input value={produto} disabled
                className="w-full rounded-lg border border-nex-gray-200 bg-nex-gray-50 px-3 py-2 text-sm text-nex-gray-500" />
            )}
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
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-heading font-semibold text-nex-black">
              Empresas encontradas ({empresas.length}) · {selecionadas.length} selecionada(s) com e-mail
            </h3>
            {!mostrarSalvar ? (
              <button onClick={() => { setMostrarSalvar(true); setNomeParaSalvar(nicho ? `${nicho} — ${new Date().toLocaleDateString('pt-BR')}` : '') }}
                className="flex items-center gap-1.5 text-xs text-nex-gray-500 hover:text-nex-black">
                <Save className="w-3.5 h-3.5" /> Salvar lista
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input value={nomeParaSalvar} onChange={e => setNomeParaSalvar(e.target.value)} placeholder="Nome da lista"
                  className="rounded-md border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                <button onClick={salvarLista} disabled={!nomeParaSalvar.trim() || salvando}
                  className="flex items-center gap-1 text-xs bg-nex-black text-white px-3 py-1 rounded-md hover:bg-nex-gray-700 disabled:opacity-40">
                  {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Confirmar
                </button>
                <button onClick={() => setMostrarSalvar(false)} className="text-xs text-nex-gray-400 hover:text-nex-black">Cancelar</button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-nex-gray-400 border-b border-nex-gray-100">
                  <th className="py-2 pr-2 w-8"></th>
                  <th className="py-2 pr-2">Empresa</th>
                  <th className="py-2 pr-2">Contato</th>
                  <th className="py-2 pr-2">E-mail Principal</th>
                  <th className="py-2 pr-2">E-mail Secundário</th>
                  <th className="py-2 pr-2">Segmento</th>
                  {modoEnvio === 'individual' && <th className="py-2 pr-2">Envio individual</th>}
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
                      <input value={e.email} onChange={ev => update(i, { email: ev.target.value })} placeholder="pessoa@empresa.com"
                        className="w-40 rounded border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                    </td>
                    <td className="py-2 pr-2">
                      <input value={e.emailSecundario} onChange={ev => update(i, { emailSecundario: ev.target.value })} placeholder="contato@empresa.com"
                        className="w-40 rounded border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                    </td>
                    <td className="py-2 pr-2 text-nex-gray-500 text-xs">{e.segmento}</td>
                    {modoEnvio === 'individual' && (
                      <td className="py-2 pr-2">
                        {enviadosIdx.has(i) ? (
                          <span className="flex items-center gap-1 text-xs text-green-600"><Check className="w-3.5 h-3.5" /> Enviado</span>
                        ) : (
                          <button onClick={() => abrirEdicaoIndividual(i)} disabled={!e.email.trim()}
                            className="flex items-center gap-1 text-xs text-nex-gray-500 hover:text-nex-black disabled:opacity-30">
                            <Mail className="w-3.5 h-3.5" /> Ver e enviar
                          </button>
                        )}
                      </td>
                    )}
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

      {/* Painel de edição individual */}
      {editandoIdx !== null && (
        <div className="bg-white border border-nex-gray-200 rounded-xl p-5 mb-5">
          <h3 className="text-sm font-heading font-semibold text-nex-black mb-3 flex items-center gap-1.5">
            <User className="w-4 h-4 text-nex-gray-400" /> Enviar para {empresas[editandoIdx]?.empresa}
          </h3>
          <input value={textoIndividual.assunto} onChange={e => setTextoIndividual(p => ({ ...p, assunto: e.target.value }))}
            className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          <textarea value={textoIndividual.corpo} onChange={e => setTextoIndividual(p => ({ ...p, corpo: e.target.value }))}
            rows={10} className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          <div className="flex items-center gap-3 mt-3">
            <button onClick={() => enviarIndividual(editandoIdx)} disabled={enviandoIdx === editandoIdx}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 transition-colors">
              {enviandoIdx === editandoIdx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar este e-mail
            </button>
            <button onClick={() => setEditandoIdx(null)} className="text-sm text-nex-gray-500 hover:text-nex-black">Cancelar</button>
          </div>
        </div>
      )}

      {/* 3. E-mail */}
      {empresas.length > 0 && (
        <div className="bg-white border border-nex-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <h3 className="text-sm font-heading font-semibold text-nex-black flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-nex-gray-400" /> E-mail de prospecção
            </h3>
            <div className="flex gap-1 rounded-lg border border-nex-gray-200 p-0.5">
              <button onClick={() => setModoEnvio('massa')}
                className={cn('flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-heading font-medium transition-colors',
                  modoEnvio === 'massa' ? 'bg-nex-black text-white' : 'text-nex-gray-500 hover:bg-nex-gray-50')}>
                <Users className="w-3.5 h-3.5" /> Em massa
              </button>
              <button onClick={() => setModoEnvio('individual')}
                className={cn('flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-heading font-medium transition-colors',
                  modoEnvio === 'individual' ? 'bg-nex-black text-white' : 'text-nex-gray-500 hover:bg-nex-gray-50')}>
                <User className="w-3.5 h-3.5" /> Um a um
              </button>
            </div>
          </div>
          <p className="text-[11px] text-nex-gray-400 mb-3">
            Use as variáveis <code className="px-1 bg-nex-gray-100 rounded">{'{{nome}}'}</code> e{' '}
            <code className="px-1 bg-nex-gray-100 rounded">{'{{empresa}}'}</code>. Envio via <strong>comercial@nexcoworking.com.br</strong>, sempre um e-mail individual para o principal e outro para o secundário (quando preenchido).
            {modoEnvio === 'individual' && ' No modo "Um a um", clique em "Ver e enviar" na tabela para revisar e editar cada e-mail antes de disparar.'}
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

          {modoEnvio === 'massa' && (
            <div className="flex items-center gap-3 mt-4">
              <button onClick={enviarMassa} disabled={selecionadas.length === 0 || !assunto.trim() || !corpo.trim() || enviando}
                className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-heading font-medium transition-colors',
                  'bg-nex-black text-white hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none')}>
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {enviando ? 'Enviando…' : `Enviar para ${selecionadas.length} empresa(s) (${totalEmailsMassa} e-mail(s))`}
              </button>
              {statusEnvio && <span className="text-sm text-nex-gray-600">{statusEnvio}</span>}
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  )
}
