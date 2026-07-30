'use client'

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard } from '@/components/layout/SectionCard'
import { StatTile } from '@/components/layout/StatTile'
import { Send, Upload, Mail, Loader2, Users, User, Check, Building2, Tag, Plus, Pencil, Trash2, Save, Database, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContatoImportado {
  empresa: string
  nome: string
  email: string
  whatsapp: string
  produto: string
}

interface Contato extends ContatoImportado {
  id: string
  created_at: string
}

// Ordem oficial das colunas (com ou sem cabeçalho, cole texto ou planilha): empresa, nome, e-mail, whatsapp, produto.
// Campo em branco não desloca os demais — mantém a posição vazia entre as vírgulas (ou a célula vazia na planilha).
const COLUNAS_CCO = ['empresa', 'nome', 'email', 'whatsapp', 'produto'] as const

function parseCSV(texto: string): ContatoImportado[] {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (linhas.length === 0) return []
  const sep = (linhas[0].includes(';') && !linhas[0].includes(',')) ? ';' : (linhas[0].match(/;/g)?.length ?? 0) > (linhas[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const header = linhas[0].toLowerCase()
  const temHeader = /nome|email|e-mail|empresa|produto|whatsapp/.test(header)
  const cols = temHeader ? linhas[0].split(sep).map(c => c.trim().toLowerCase()) : [...COLUNAS_CCO]
  const idxEmpresa = cols.findIndex(c => c.includes('empresa'))
  const idxNome = cols.findIndex(c => c.includes('nome'))
  const idxEmail = cols.findIndex(c => c.includes('email') || c.includes('e-mail'))
  const idxWhatsapp = cols.findIndex(c => c.includes('whatsapp') || c.includes('whats'))
  const idxProduto = cols.findIndex(c => c.includes('produto'))
  const dados = temHeader ? linhas.slice(1) : linhas
  return dados.map(linha => {
    const p = linha.split(sep).map(c => c.trim())
    return {
      empresa: idxEmpresa >= 0 ? p[idxEmpresa] ?? '' : p[0] ?? '',
      nome: idxNome >= 0 ? p[idxNome] ?? '' : p[1] ?? '',
      email: idxEmail >= 0 ? p[idxEmail] ?? '' : p[2] ?? '',
      whatsapp: idxWhatsapp >= 0 ? p[idxWhatsapp] ?? '' : p[3] ?? '',
      produto: idxProduto >= 0 ? p[idxProduto] ?? '' : p[4] ?? '',
    }
  }).filter(c => c.email.includes('@'))
}

function aplicar(texto: string, c: ContatoImportado): string {
  return texto
    .replace(/\{\{\s*nome\s*\}\}/gi, c.nome || '')
    .replace(/\{\{\s*empresa\s*\}\}/gi, c.empresa || '')
    .replace(/\{\{\s*whatsapp\s*\}\}/gi, c.whatsapp || '')
    .replace(/\{\{\s*produto\s*\}\}/gi, c.produto || '')
}

const FORM_VAZIO: ContatoImportado = { empresa: '', nome: '', email: '', whatsapp: '', produto: '' }

export default function CcoPage() {
  const [aba, setAba] = useState<'base' | 'enviar'>('base')

  // Base de contatos (persistida)
  const [contatos, setContatos] = useState<Contato[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erroBase, setErroBase] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  // Importação (cola texto ou planilha) — some vez salva na base
  const [raw, setRaw] = useState('')
  const [importando, setImportando] = useState(false)

  // Cadastro/edição manual de um contato
  const [form, setForm] = useState<ContatoImportado>(FORM_VAZIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [salvandoForm, setSalvandoForm] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)

  const [excluindoIds, setExcluindoIds] = useState<Set<string>>(new Set())

  // Envio de e-mail (etapa separada, sobre os contatos já cadastrados)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [modoEnvio, setModoEnvio] = useState<'massa' | 'individual'>('massa')
  const [editandoEnvioId, setEditandoEnvioId] = useState<string | null>(null)
  const [textoIndividual, setTextoIndividual] = useState({ assunto: '', corpo: '' })
  const [enviadosIds, setEnviadosIds] = useState<Set<string>>(new Set())
  const [enviandoId, setEnviandoId] = useState<string | null>(null)

  async function carregarContatos() {
    setCarregando(true)
    setErroBase(null)
    try {
      const res = await fetch('/api/cco/contatos')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setContatos(json.contatos ?? [])
    } catch (e) {
      setErroBase(e instanceof Error ? e.message : 'Falha ao carregar a base de contatos')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregarContatos() }, [])

  const contatosImportados = useMemo(() => parseCSV(raw), [raw])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.toLowerCase().split('.').pop()
    if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      setRaw(XLSX.utils.sheet_to_csv(sheet))
      return
    }
    const reader = new FileReader()
    reader.onload = () => setRaw(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  async function salvarImportados() {
    if (contatosImportados.length === 0 || importando) return
    setImportando(true)
    setErroBase(null)
    try {
      const res = await fetch('/api/cco/contatos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contatos: contatosImportados }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setRaw('')
      await carregarContatos()
    } catch (e) {
      setErroBase(e instanceof Error ? e.message : 'Falha ao salvar os contatos importados')
    } finally {
      setImportando(false)
    }
  }

  function abrirNovoContato() {
    setForm(FORM_VAZIO)
    setEditandoId(null)
    setMostrarForm(true)
  }

  function abrirEdicaoContato(c: Contato) {
    setForm({ empresa: c.empresa, nome: c.nome, email: c.email, whatsapp: c.whatsapp, produto: c.produto })
    setEditandoId(c.id)
    setMostrarForm(true)
  }

  async function salvarContato() {
    if (!form.email.includes('@') || salvandoForm) return
    setSalvandoForm(true)
    setErroBase(null)
    try {
      const res = editandoId
        ? await fetch(`/api/cco/contatos/${editandoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          })
        : await fetch('/api/cco/contatos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contato: form }),
          })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setMostrarForm(false)
      setForm(FORM_VAZIO)
      setEditandoId(null)
      await carregarContatos()
    } catch (e) {
      setErroBase(e instanceof Error ? e.message : 'Falha ao salvar o contato')
    } finally {
      setSalvandoForm(false)
    }
  }

  async function excluirContato(id: string) {
    setExcluindoIds(prev => new Set(prev).add(id))
    try {
      await fetch(`/api/cco/contatos/${id}`, { method: 'DELETE' })
      setContatos(prev => prev.filter(c => c.id !== id))
      setSelecionados(prev => { const n = new Set(prev); n.delete(id); return n })
    } catch {
      setErroBase('Falha ao excluir o contato')
    } finally {
      setExcluindoIds(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const contatosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return contatos
    return contatos.filter(c =>
      [c.empresa, c.nome, c.email, c.whatsapp, c.produto].some(v => (v ?? '').toLowerCase().includes(termo))
    )
  }, [contatos, busca])

  const selecionadosArr = useMemo(() => contatos.filter(c => selecionados.has(c.id)), [contatos, selecionados])
  const preview = selecionadosArr[0]

  function alternarSelecao(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selecionarTodosFiltrados() {
    setSelecionados(new Set(contatosFiltrados.map(c => c.id)))
  }

  async function enviar() {
    if (selecionadosArr.length === 0 || !assunto.trim() || !corpo.trim() || enviando) return
    setEnviando(true)
    setStatus(null)
    try {
      const res = await fetch('/api/cco/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assunto, corpo, destinatarios: selecionadosArr }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setStatus(`Enviados: ${json.enviados ?? 0} · Falhas: ${json.falhas ?? 0}`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Falha no envio')
    } finally {
      setEnviando(false)
    }
  }

  function abrirEdicaoIndividual(c: Contato) {
    setEditandoEnvioId(c.id)
    setTextoIndividual({ assunto: aplicar(assunto, c), corpo: aplicar(corpo, c) })
  }

  async function enviarIndividual(c: Contato) {
    if (!textoIndividual.assunto.trim() || !textoIndividual.corpo.trim()) return
    setEnviandoId(c.id)
    try {
      const res = await fetch('/api/cco/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assunto: textoIndividual.assunto, corpo: textoIndividual.corpo, destinatarios: [c] }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setEnviadosIds(prev => new Set(prev).add(c.id))
      setEditandoEnvioId(null)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Falha ao enviar este e-mail')
    } finally {
      setEnviandoId(null)
    }
  }

  return (
    <div>
      <PageHeader title="Sistema CCO" description="Base de contatos gerenciável para contato periódico por empresa, cliente e produto. O envio de e-mail é uma etapa separada, feita só quando necessário." />

      <div className="flex gap-2 mb-5">
        <button onClick={() => setAba('base')}
          className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-heading font-medium border transition-colors',
            aba === 'base' ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
          <Database className="w-3.5 h-3.5" /> Base de Contatos
        </button>
        <button onClick={() => setAba('enviar')}
          className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-heading font-medium border transition-colors',
            aba === 'enviar' ? 'border-nex-black bg-nex-gray-50 text-nex-black' : 'border-nex-gray-200 text-nex-gray-500 hover:bg-nex-gray-50')}>
          <Mail className="w-3.5 h-3.5" /> Enviar E-mail
        </button>
      </div>

      {erroBase && <p className="text-sm text-red-600 mb-4">{erroBase}</p>}

      {aba === 'base' ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatTile icon={Users} label="Contatos na base" value={contatos.length} />
            <StatTile icon={Building2} label="Empresas distintas" value={new Set(contatos.map(c => c.empresa).filter(Boolean)).size} />
            <StatTile icon={Tag} label="Produtos distintos" value={new Set(contatos.map(c => c.produto).filter(Boolean)).size} />
            <StatTile icon={FolderOpen} label="Selecionados p/ envio" value={selecionados.size} />
          </div>

          <SectionCard
            step={1}
            icon={Upload}
            title="Importar para a base"
            subtitle="Cole a lista ou importe um arquivo — os contatos são salvos, não enviados agora"
            actions={
              <label className="flex items-center gap-1.5 text-xs text-nex-gray-500 hover:text-nex-black cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Importar CSV ou Excel
                <input type="file" accept=".csv,text/csv,text/plain,.xls,.xlsx" onChange={onFile} className="hidden" />
              </label>
            }
            className="mb-5"
          >
            <textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              rows={8}
              placeholder={'empresa,nome,email,whatsapp,produto\nEmpresa X,João Silva,joao@empresa.com,(41) 99999-0000,Escritório Privativo\nABC Ltda,Maria,maria@abc.com,,Sala de Reunião'}
              className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-nex-gray-400"
            />
            <p className="text-[11px] text-nex-gray-400 mt-2">
              Colunas (nessa ordem, com ou sem cabeçalho): empresa, nome, e-mail, whatsapp, produto. Um campo em branco fica só com a posição vazia entre as vírgulas — não desloca os demais. Contatos com o mesmo e-mail já cadastrado são atualizados, não duplicados.
            </p>
            {contatosImportados.length > 0 && (
              <div className="flex items-center gap-3 mt-3">
                <button onClick={salvarImportados} disabled={importando}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 transition-colors">
                  {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {importando ? 'Salvando…' : `Salvar ${contatosImportados.length} contato(s) na base`}
                </button>
              </div>
            )}
          </SectionCard>

          <SectionCard
            step={2}
            icon={Database}
            title="Contatos cadastrados"
            subtitle={`${contatosFiltrados.length} de ${contatos.length} contato(s)`}
            actions={
              <div className="flex items-center gap-3">
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…"
                  className="rounded-md border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                <button onClick={abrirNovoContato} className="flex items-center gap-1.5 text-xs text-nex-gray-500 hover:text-nex-black">
                  <Plus className="w-3.5 h-3.5" /> Novo contato
                </button>
              </div>
            }
          >
            {mostrarForm && (
              <div className="mb-4 p-3 rounded-lg border border-nex-gray-200 bg-nex-gray-50/60">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  <input value={form.empresa} onChange={e => setForm(p => ({ ...p, empresa: e.target.value }))} placeholder="Empresa"
                    className="rounded-md border border-nex-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                  <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome"
                    className="rounded-md border border-nex-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                  <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="E-mail"
                    className="rounded-md border border-nex-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                  <input value={form.whatsapp} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="Whatsapp"
                    className="rounded-md border border-nex-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                  <input value={form.produto} onChange={e => setForm(p => ({ ...p, produto: e.target.value }))} placeholder="Produto"
                    className="rounded-md border border-nex-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                </div>
                <div className="flex items-center gap-3 mt-2.5">
                  <button onClick={salvarContato} disabled={!form.email.includes('@') || salvandoForm}
                    className="flex items-center gap-1.5 text-xs bg-nex-black text-white px-3 py-1.5 rounded-md hover:bg-nex-gray-700 disabled:opacity-40">
                    {salvandoForm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {editandoId ? 'Salvar alterações' : 'Cadastrar'}
                  </button>
                  <button onClick={() => { setMostrarForm(false); setEditandoId(null) }} className="text-xs text-nex-gray-400 hover:text-nex-black">Cancelar</button>
                </div>
              </div>
            )}

            {carregando ? (
              <div className="flex items-center justify-center gap-2 py-10 text-nex-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
              </div>
            ) : contatosFiltrados.length === 0 ? (
              <div className="py-10 text-center text-sm text-nex-gray-300">
                {contatos.length === 0 ? 'Nenhum contato cadastrado ainda. Importe uma lista ou cadastre manualmente acima.' : 'Nenhum contato encontrado para essa busca.'}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-5 -mb-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400 bg-nex-gray-50 border-y border-nex-gray-100">
                      <th className="py-2 pl-5 pr-2">Empresa / Contato</th>
                      <th className="py-2 pr-2">E-mail</th>
                      <th className="py-2 pr-2">Whatsapp</th>
                      <th className="py-2 pr-2">Produto</th>
                      <th className="py-2 pr-5 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {contatosFiltrados.map(c => (
                      <tr key={c.id} className="border-b border-nex-gray-50 hover:bg-nex-gray-50/60 transition-colors">
                        <td className="py-2.5 pl-5 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-nex-gray-100 text-nex-gray-600 text-xs font-heading font-semibold flex items-center justify-center">
                              {(c.empresa || c.nome || '?').charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <div className="font-heading font-medium text-nex-gray-800 truncate">{c.empresa || '—'}</div>
                              <div className="text-[11px] text-nex-gray-400 truncate">{c.nome || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 pr-2 text-nex-gray-600">{c.email}</td>
                        <td className="py-2.5 pr-2 text-nex-gray-500">{c.whatsapp || '—'}</td>
                        <td className="py-2.5 pr-2">
                          {c.produto ? <span className="inline-block text-[11px] bg-nex-gray-100 text-nex-gray-600 rounded-full px-2 py-0.5">{c.produto}</span> : <span className="text-nex-gray-300 text-xs">—</span>}
                        </td>
                        <td className="py-2.5 pr-5">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => abrirEdicaoContato(c)} className="p-1.5 text-nex-gray-400 hover:text-nex-black hover:bg-nex-gray-100 rounded transition-colors" title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => excluirContato(c.id)} disabled={excluindoIds.has(c.id)} className="p-1.5 text-nex-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40" title="Excluir">
                              {excluindoIds.has(c.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatTile icon={Users} label="Contatos na base" value={contatos.length} />
            <StatTile icon={Check} label="Selecionados" value={selecionados.size} tone={selecionados.size > 0 ? 'success' : 'default'} />
            <StatTile icon={Mail} label="Modo de envio" value={modoEnvio === 'massa' ? 'Em massa' : 'Um a um'} />
          </div>

          <SectionCard
            step={1}
            icon={Users}
            title="Selecionar destinatários"
            subtitle="Marque os contatos da base que devem receber este e-mail agora"
            actions={
              <div className="flex items-center gap-3">
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar…"
                  className="rounded-md border border-nex-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                <button onClick={selecionarTodosFiltrados} className="text-xs text-nex-gray-500 hover:text-nex-black">Selecionar todos</button>
                <button onClick={() => setSelecionados(new Set())} className="text-xs text-nex-gray-400 hover:text-nex-black">Limpar</button>
              </div>
            }
            className="mb-5"
          >
            {carregando ? (
              <div className="flex items-center justify-center gap-2 py-10 text-nex-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
              </div>
            ) : contatosFiltrados.length === 0 ? (
              <div className="py-10 text-center text-sm text-nex-gray-300">
                Nenhum contato na base ainda. Cadastre na aba &quot;Base de Contatos&quot; primeiro.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto -mx-5 -mb-5">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="text-left text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400 bg-nex-gray-50 border-y border-nex-gray-100">
                      <th className="py-2 pl-5 pr-2 w-8"></th>
                      <th className="py-2 pr-2">Empresa / Contato</th>
                      <th className="py-2 pr-2">Produto</th>
                      {modoEnvio === 'individual' && <th className="py-2 pr-5">Envio individual</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {contatosFiltrados.map(c => (
                      <tr key={c.id} className="border-b border-nex-gray-50 hover:bg-nex-gray-50/60 transition-colors">
                        <td className="py-2 pl-5 pr-2">
                          <input type="checkbox" checked={selecionados.has(c.id)} onChange={() => alternarSelecao(c.id)} />
                        </td>
                        <td className="py-2 pr-2">
                          <div className="font-medium text-nex-gray-800">{c.empresa || c.nome}</div>
                          <div className="text-[11px] text-nex-gray-400">{c.nome} · {c.email}</div>
                        </td>
                        <td className="py-2 pr-2 text-nex-gray-500 text-xs">{c.produto || '—'}</td>
                        {modoEnvio === 'individual' && (
                          <td className="py-2 pr-5">
                            {enviadosIds.has(c.id) ? (
                              <span className="flex items-center gap-1 text-xs text-green-600"><Check className="w-3.5 h-3.5" /> Enviado</span>
                            ) : (
                              <button onClick={() => abrirEdicaoIndividual(c)} className="flex items-center gap-1 text-xs text-nex-gray-500 hover:text-nex-black">
                                <Mail className="w-3.5 h-3.5" /> Ver e enviar
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {editandoEnvioId !== null && (
            <SectionCard icon={User} title={`Enviar para ${contatos.find(c => c.id === editandoEnvioId)?.empresa || ''}`} className="mb-5">
              <input value={textoIndividual.assunto} onChange={e => setTextoIndividual(p => ({ ...p, assunto: e.target.value }))}
                className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
              <textarea value={textoIndividual.corpo} onChange={e => setTextoIndividual(p => ({ ...p, corpo: e.target.value }))}
                rows={9} className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
              <div className="flex items-center gap-3 mt-3">
                <button onClick={() => { const c = contatos.find(x => x.id === editandoEnvioId); if (c) enviarIndividual(c) }} disabled={enviandoId === editandoEnvioId}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 transition-colors">
                  {enviandoId === editandoEnvioId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar este e-mail
                </button>
                <button onClick={() => setEditandoEnvioId(null)} className="text-sm text-nex-gray-500 hover:text-nex-black">Cancelar</button>
              </div>
            </SectionCard>
          )}

          <SectionCard
            step={2}
            icon={Mail}
            title="Mensagem"
            subtitle="Envio via comercial@nex.work"
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
              Variáveis: <code className="px-1 bg-nex-gray-100 rounded">{'{{nome}}'}</code>{' '}
              <code className="px-1 bg-nex-gray-100 rounded">{'{{empresa}}'}</code>{' '}
              <code className="px-1 bg-nex-gray-100 rounded">{'{{whatsapp}}'}</code>{' '}
              <code className="px-1 bg-nex-gray-100 rounded">{'{{produto}}'}</code>
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <input value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Assunto"
                  className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
                <textarea value={corpo} onChange={e => setCorpo(e.target.value)} rows={9} placeholder="Olá {{nome}}, sobre o seu {{produto}} na {{empresa}}…"
                  className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
              </div>
              {preview && (
                <div className="rounded-lg border border-nex-gray-200 overflow-hidden self-start">
                  <div className="bg-nex-gray-50 px-3.5 py-2 border-b border-nex-gray-200 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-nex-gray-400" />
                    <span className="text-[10px] font-heading font-semibold uppercase tracking-wide text-nex-gray-400">Prévia · {preview.email}</span>
                  </div>
                  <div className="p-3.5">
                    <p className="text-sm font-heading font-medium text-nex-gray-800 mb-2">{aplicar(assunto, preview)}</p>
                    <p className="text-sm text-nex-gray-600 whitespace-pre-wrap">{aplicar(corpo, preview)}</p>
                  </div>
                </div>
              )}
            </div>

            {modoEnvio === 'massa' && (
              <div className="flex items-center gap-3 mt-5 pt-4 border-t border-nex-gray-100">
                <button onClick={enviar} disabled={selecionadosArr.length === 0 || !assunto.trim() || !corpo.trim() || enviando}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-sm">
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {enviando ? 'Enviando…' : `Disparar para ${selecionadosArr.length} contato(s)`}
                </button>
                {status && <span className="text-sm text-nex-gray-600 px-3 py-1.5 rounded-lg bg-nex-gray-50 border border-nex-gray-100">{status}</span>}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}
