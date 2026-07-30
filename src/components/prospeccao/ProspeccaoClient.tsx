'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard } from '@/components/layout/SectionCard'
import { StatTile } from '@/components/layout/StatTile'
import { RemetenteAssinatura } from '@/components/disparo/RemetenteAssinatura'
import { BarraProgresso } from '@/components/disparo/BarraProgresso'
import { REMETENTES_DISPARO } from '@/lib/remetentes'
import { Sparkles, Send, Search, Trash2, Mail, Loader2, Users, User, Check, Save, FolderOpen, Download, Upload, Building2, AtSign, MailWarning, Info } from 'lucide-react'
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
  const [remetente, setRemetente] = useState(REMETENTES_DISPARO[0].email)
  const [progressoEnvio, setProgressoEnvio] = useState<{ feito: number; total: number } | null>(null)

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
    setProgressoEnvio({ feito: 0, total: selecionadas.length })
    let enviados = 0
    let falhas = 0
    // Envia empresa por empresa (em vez de tudo numa única requisição) para poder
    // mostrar o progresso do disparo em tempo real.
    for (let i = 0; i < selecionadas.length; i++) {
      const e = selecionadas[i]
      try {
        const res = await fetch('/api/prospeccao/enviar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo,
            assunto,
            corpo,
            remetente,
            destinatarios: [{ email: e.email, emailSecundario: e.emailSecundario, nome: e.contato, empresa: e.empresa }],
          }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
        enviados += json.enviados ?? 0
        falhas += json.falhas ?? 0
      } catch {
        falhas++
      }
      setProgressoEnvio({ feito: i + 1, total: selecionadas.length })
    }
    setStatusEnvio(`Enviados: ${enviados} · Falhas: ${falhas}`)
    setEnviando(false)
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
          remetente,
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
        <SectionCard
          icon={FolderOpen}
          title="Listas salvas"
          subtitle={listasSalvas.length > 0 ? `${listasSalvas.length} lista(s) guardada(s)` : undefined}
          actions={carregandoListas ? <Loader2 className="w-3.5 h-3.5 animate-spin text-nex-gray-300" /> : undefined}
        >
          {listasSalvas.length === 0 ? (
            <div className="py-10 text-center text-sm text-nex-gray-300">
              {carregandoListas ? 'Carregando…' : 'Nenhuma lista salva ainda. Gere e salve uma lista na aba "Gerar Nova Lista".'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {listasSalvas.map(l => (
                <div key={l.id} className="group border border-nex-gray-200 rounded-lg px-4 py-3 hover:border-nex-gray-300 hover:bg-nex-gray-50/60 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-heading font-medium text-nex-gray-800 truncate">{l.nome}</p>
                      <p className="text-[11px] text-nex-gray-400 mt-0.5">
                        {l.produto ?? l.nicho ?? '—'} · {new Date(l.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-[10px] font-heading font-semibold uppercase tracking-wide bg-nex-gray-100 text-nex-gray-500 rounded-full px-2 py-0.5">
                      {l.empresas.length} empresa{l.empresas.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-nex-gray-100">
                    <button onClick={() => carregarLista(l)} className="flex items-center gap-1 text-xs text-nex-gray-500 hover:text-nex-black">
                      <Upload className="w-3.5 h-3.5" /> Carregar
                    </button>
                    <button onClick={() => exportarCsv(l)} className="flex items-center gap-1 text-xs text-nex-gray-500 hover:text-nex-black">
                      <Download className="w-3.5 h-3.5" /> Exportar CSV
                    </button>
                    <button onClick={() => excluirLista(l.id)} className="flex items-center gap-1 text-xs text-nex-gray-300 hover:text-red-500 ml-auto">
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      ) : (
      <>
      {/* 1. Critérios de busca */}
      <SectionCard step={1} icon={Search} title="Critérios de prospecção" subtitle="Defina o público-alvo — a IA busca empresas reais na web e só traz e-mails verificados" className="mb-5">
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
          className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-sm">
          {loadingGerar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loadingGerar ? 'Buscando empresas na web…' : 'Gerar lista de empresas'}
        </button>
        <div className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded-lg bg-nex-yellow/10 border border-nex-yellow/30">
          <Info className="w-3.5 h-3.5 text-nex-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-nex-gray-500">
            A lista é gerada por IA com busca real na web (site institucional, Google e LinkedIn) — só entram e-mails efetivamente encontrados.
            Ainda assim, valide os contatos antes do envio.
          </p>
        </div>
      </SectionCard>

      {/* 2. Lista de empresas */}
      {empresas.length > 0 && (
        <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatTile icon={Building2} label="Empresas encontradas" value={empresas.length} />
          <StatTile icon={Check} label="Selecionadas c/ e-mail" value={selecionadas.length} tone="success" />
          <StatTile icon={MailWarning} label="Sem e-mail" value={empresas.length - selecionadas.length} tone={empresas.length - selecionadas.length > 0 ? 'warning' : 'default'} />
          <StatTile icon={AtSign} label="E-mails a enviar" value={totalEmailsMassa} />
        </div>
        <SectionCard
          step={2}
          icon={Users}
          title="Empresas encontradas"
          subtitle={`${empresas.length} no total · ${selecionadas.length} selecionada(s) com e-mail`}
          className="mb-5"
          actions={!mostrarSalvar ? (
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
        >
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400 bg-nex-gray-50 border-y border-nex-gray-100">
                  <th className="py-2 pl-5 pr-2 w-8"></th>
                  <th className="py-2 pr-2">Empresa</th>
                  <th className="py-2 pr-2">Contato</th>
                  <th className="py-2 pr-2">E-mail Principal</th>
                  <th className="py-2 pr-2">E-mail Secundário</th>
                  <th className="py-2 pr-2">Segmento</th>
                  {modoEnvio === 'individual' && <th className="py-2 pr-2">Envio individual</th>}
                  <th className="py-2 pr-5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e, i) => (
                  <tr key={i} className={cn('border-b border-nex-gray-50 align-top transition-colors hover:bg-nex-gray-50/60', !e.email.trim() && 'bg-red-50/30')}>
                    <td className="py-2.5 pl-5 pr-2">
                      <input type="checkbox" checked={e.selecionada} onChange={ev => update(i, { selecionada: ev.target.checked })} />
                    </td>
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-nex-gray-100 text-nex-gray-600 text-xs font-heading font-semibold flex items-center justify-center">
                          {(e.empresa || '?').charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="font-heading font-medium text-nex-gray-800 truncate">{e.empresa}</div>
                          <div className="text-[11px] text-nex-gray-400 truncate">{e.regiao} {e.site && `· ${e.site}`}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-2 text-nex-gray-600">{e.contato || '—'}</td>
                    <td className="py-2.5 pr-2">
                      <input value={e.email} onChange={ev => update(i, { email: ev.target.value })} placeholder="pessoa@empresa.com"
                        className={cn('w-40 rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400',
                          e.email.trim() ? 'border-nex-gray-200' : 'border-red-200 placeholder:text-red-300')} />
                    </td>
                    <td className="py-2.5 pr-2">
                      <input value={e.emailSecundario} onChange={ev => update(i, { emailSecundario: ev.target.value })} placeholder="contato@empresa.com"
                        className="w-40 rounded border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                    </td>
                    <td className="py-2.5 pr-2">
                      {e.segmento ? (
                        <span className="inline-block text-[11px] bg-nex-gray-100 text-nex-gray-600 rounded-full px-2 py-0.5">{e.segmento}</span>
                      ) : <span className="text-nex-gray-300 text-xs">—</span>}
                    </td>
                    {modoEnvio === 'individual' && (
                      <td className="py-2.5 pr-2">
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
                    <td className="py-2.5 pr-5">
                      <button onClick={() => setEmpresas(prev => prev.filter((_, idx) => idx !== i))} className="text-nex-gray-300 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
        </>
      )}

      {/* Painel de edição individual */}
      {editandoIdx !== null && (
        <SectionCard icon={User} title={`Enviar para ${empresas[editandoIdx]?.empresa}`} className="mb-5">
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
        </SectionCard>
      )}

      {/* 3. E-mail */}
      {empresas.length > 0 && (
        <SectionCard
          step={3}
          icon={Mail}
          title="E-mail de prospecção"
          subtitle={modoEnvio === 'massa' ? `${totalEmailsMassa} e-mail(s) a enviar` : 'revise e envie um a um'}
          actions={
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
          }
        >
          <p className="text-[11px] text-nex-gray-400 mb-3">
            Use as variáveis <code className="px-1 bg-nex-gray-100 rounded">{'{{nome}}'}</code> e{' '}
            <code className="px-1 bg-nex-gray-100 rounded">{'{{empresa}}'}</code>. Sempre um e-mail individual para o principal e outro para o secundário (quando preenchido).
            {modoEnvio === 'individual' && ' No modo "Um a um", clique em "Ver e enviar" na tabela para revisar e editar cada e-mail antes de disparar.'}
          </p>

          <div className="mb-4 pb-4 border-b border-nex-gray-100">
            <RemetenteAssinatura remetente={remetente} onChangeRemetente={setRemetente} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <input value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Assunto do e-mail"
                className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
              <textarea value={corpo} onChange={e => setCorpo(e.target.value)} rows={11} placeholder="Olá {{nome}}, tudo bem? Notamos que a {{empresa}}…"
                className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
            </div>

            {preview && (
              <div className="rounded-lg border border-nex-gray-200 overflow-hidden self-start">
                <div className="bg-nex-gray-50 px-3.5 py-2 border-b border-nex-gray-200 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-nex-gray-400" />
                  <span className="text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Prévia · {preview.empresa}</span>
                </div>
                <div className="px-3.5 py-2 border-b border-nex-gray-100 text-[11px] text-nex-gray-400 space-y-0.5">
                  <p><span className="text-nex-gray-300">De:</span> {remetente}</p>
                  <p><span className="text-nex-gray-300">Para:</span> {preview.email || preview.emailSecundario || '—'}</p>
                </div>
                <div className="p-3.5">
                  <p className="text-sm font-heading font-medium text-nex-gray-800 mb-2">{aplicarVariaveis(assunto, preview)}</p>
                  <p className="text-sm text-nex-gray-600 whitespace-pre-wrap">{aplicarVariaveis(corpo, preview)}</p>
                </div>
              </div>
            )}
          </div>

          {modoEnvio === 'massa' && (
            <div className="mt-5 pt-4 border-t border-nex-gray-100">
            <div className="flex items-center gap-3">
              <button onClick={enviarMassa} disabled={selecionadas.length === 0 || !assunto.trim() || !corpo.trim() || enviando}
                className={cn('flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-heading font-medium transition-colors shadow-sm',
                  'bg-nex-black text-white hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none')}>
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {enviando ? 'Enviando…' : `Enviar para ${selecionadas.length} empresa(s) (${totalEmailsMassa} e-mail(s))`}
              </button>
              {statusEnvio && (
                <span className="text-sm text-nex-gray-600 px-3 py-1.5 rounded-lg bg-nex-gray-50 border border-nex-gray-100">{statusEnvio}</span>
              )}
            </div>
            {progressoEnvio && <BarraProgresso feito={progressoEnvio.feito} total={progressoEnvio.total} />}
            </div>
          )}
        </SectionCard>
      )}
      </>
      )}
    </div>
  )
}
