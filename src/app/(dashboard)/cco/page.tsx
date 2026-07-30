'use client'

import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard } from '@/components/layout/SectionCard'
import { StatTile } from '@/components/layout/StatTile'
import { Send, Upload, Mail, Loader2, Users, User, Check, Building2, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Contato {
  nome: string
  email: string
  empresa: string
  produto: string
}

function parseCSV(texto: string): Contato[] {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (linhas.length === 0) return []
  // detecta separador
  const sep = (linhas[0].includes(';') && !linhas[0].includes(',')) ? ';' : (linhas[0].match(/;/g)?.length ?? 0) > (linhas[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const header = linhas[0].toLowerCase()
  const temHeader = /nome|email|e-mail|empresa|produto/.test(header)
  const cols = temHeader ? linhas[0].split(sep).map(c => c.trim().toLowerCase()) : ['nome', 'email', 'empresa', 'produto']
  const idxNome = cols.findIndex(c => c.includes('nome'))
  const idxEmail = cols.findIndex(c => c.includes('email') || c.includes('e-mail'))
  const idxEmpresa = cols.findIndex(c => c.includes('empresa'))
  const idxProduto = cols.findIndex(c => c.includes('produto'))
  const dados = temHeader ? linhas.slice(1) : linhas
  return dados.map(linha => {
    const p = linha.split(sep).map(c => c.trim())
    return {
      nome: idxNome >= 0 ? p[idxNome] ?? '' : p[0] ?? '',
      email: idxEmail >= 0 ? p[idxEmail] ?? '' : p[1] ?? '',
      empresa: idxEmpresa >= 0 ? p[idxEmpresa] ?? '' : p[2] ?? '',
      produto: idxProduto >= 0 ? p[idxProduto] ?? '' : p[3] ?? '',
    }
  }).filter(c => c.email.includes('@'))
}

function aplicar(texto: string, c: Contato): string {
  return texto
    .replace(/\{\{\s*nome\s*\}\}/gi, c.nome || '')
    .replace(/\{\{\s*empresa\s*\}\}/gi, c.empresa || '')
    .replace(/\{\{\s*produto\s*\}\}/gi, c.produto || '')
}

export default function CcoPage() {
  const [raw, setRaw] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [modoEnvio, setModoEnvio] = useState<'massa' | 'individual'>('massa')

  const [editandoIdx, setEditandoIdx] = useState<number | null>(null)
  const [textoIndividual, setTextoIndividual] = useState({ assunto: '', corpo: '' })
  const [enviadosIdx, setEnviadosIdx] = useState<Set<number>>(new Set())
  const [enviandoIdx, setEnviandoIdx] = useState<number | null>(null)

  const contatos = useMemo(() => parseCSV(raw), [raw])
  const preview = contatos[0]

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

  async function enviar() {
    if (contatos.length === 0 || !assunto.trim() || !corpo.trim() || enviando) return
    setEnviando(true)
    setStatus(null)
    try {
      const res = await fetch('/api/cco/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assunto, corpo, destinatarios: contatos }),
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

  function abrirEdicaoIndividual(i: number) {
    const c = contatos[i]
    setEditandoIdx(i)
    setTextoIndividual({ assunto: aplicar(assunto, c), corpo: aplicar(corpo, c) })
  }

  async function enviarIndividual(i: number) {
    const c = contatos[i]
    if (!c.email.trim() || !textoIndividual.assunto.trim() || !textoIndividual.corpo.trim()) return
    setEnviandoIdx(i)
    try {
      const res = await fetch('/api/cco/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assunto: textoIndividual.assunto,
          corpo: textoIndividual.corpo,
          destinatarios: [c],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`)
      setEnviadosIdx(prev => new Set(prev).add(i))
      setEditandoIdx(null)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Falha ao enviar este e-mail')
    } finally {
      setEnviandoIdx(null)
    }
  }

  return (
    <div>
      <PageHeader title="Sistema CCO" description="Disparo de e-mails para a base fixa de clientes, com contato periódico por empresa, cliente e produto." />

      {contatos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatTile icon={Users} label="Contatos válidos" value={contatos.length} />
          <StatTile icon={Building2} label="Empresas distintas" value={new Set(contatos.map(c => c.empresa).filter(Boolean)).size} />
          <StatTile icon={Tag} label="Produtos distintos" value={new Set(contatos.map(c => c.produto).filter(Boolean)).size} />
          <StatTile icon={Mail} label="Modo de envio" value={modoEnvio === 'massa' ? 'Em massa' : 'Um a um'} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Base */}
        <SectionCard
          step={1}
          icon={Users}
          title="Base de contatos"
          subtitle={contatos.length > 0 ? `${contatos.length} contato(s) detectado(s)` : 'Cole a lista ou importe um arquivo'}
          actions={
            <label className="flex items-center gap-1.5 text-xs text-nex-gray-500 hover:text-nex-black cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Importar CSV ou Excel
              <input type="file" accept=".csv,text/csv,text/plain,.xls,.xlsx" onChange={onFile} className="hidden" />
            </label>
          }
        >
          <textarea
            value={raw}
            onChange={e => setRaw(e.target.value)}
            rows={12}
            placeholder={'nome,email,empresa,produto\nJoão Silva,joao@empresa.com,Empresa X,Escritório Privativo\nMaria,maria@abc.com,ABC Ltda,Sala de Reunião'}
            className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-nex-gray-400"
          />
          <p className="text-[11px] text-nex-gray-400 mt-2">
            Colunas: nome, email, empresa, produto (com ou sem cabeçalho). Cole o texto, ou importe um arquivo .csv ou .xls/.xlsx acima.
          </p>

          {modoEnvio === 'individual' && contatos.length > 0 && (
            <div className="mt-3 border-t border-nex-gray-100 pt-3 max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left uppercase tracking-wide text-nex-gray-400">
                    <th className="py-1 pr-2">Empresa / Cliente</th>
                    <th className="py-1 pr-2">Produto</th>
                    <th className="py-1 pr-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {contatos.map((c, i) => (
                    <tr key={i} className="border-t border-nex-gray-50 hover:bg-nex-gray-50/60 transition-colors">
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-nex-gray-100 text-nex-gray-600 text-[10px] font-heading font-semibold flex items-center justify-center">
                            {(c.empresa || c.nome || '?').charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <div className="font-medium text-nex-gray-800">{c.empresa || c.nome}</div>
                            <div className="text-nex-gray-400">{c.nome} · {c.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-1.5 pr-2">
                        {c.produto ? <span className="inline-block bg-nex-gray-100 text-nex-gray-600 rounded-full px-2 py-0.5">{c.produto}</span> : <span className="text-nex-gray-300">—</span>}
                      </td>
                      <td className="py-1.5">
                        {enviadosIdx.has(i) ? (
                          <span className="flex items-center gap-1 text-green-600"><Check className="w-3 h-3" /> Enviado</span>
                        ) : (
                          <button onClick={() => abrirEdicaoIndividual(i)} className="flex items-center gap-1 text-nex-gray-500 hover:text-nex-black">
                            <Mail className="w-3 h-3" /> Ver e enviar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* E-mail */}
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
            <code className="px-1 bg-nex-gray-100 rounded">{'{{produto}}'}</code>
          </p>
          <input value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Assunto"
            className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          <textarea value={corpo} onChange={e => setCorpo(e.target.value)} rows={9} placeholder="Olá {{nome}}, sobre o seu {{produto}} na {{empresa}}…"
            className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />

          {preview && (
            <div className="mt-3 rounded-lg border border-nex-gray-200 overflow-hidden">
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
        </SectionCard>
      </div>

      {/* Painel de edição individual */}
      {editandoIdx !== null && (
        <SectionCard icon={User} title={`Enviar para ${contatos[editandoIdx]?.empresa || contatos[editandoIdx]?.nome}`} className="mt-5">
          <input value={textoIndividual.assunto} onChange={e => setTextoIndividual(p => ({ ...p, assunto: e.target.value }))}
            className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          <textarea value={textoIndividual.corpo} onChange={e => setTextoIndividual(p => ({ ...p, corpo: e.target.value }))}
            rows={9} className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
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

      {modoEnvio === 'massa' && (
        <div className="flex items-center gap-3 mt-5">
          <button onClick={enviar} disabled={contatos.length === 0 || !assunto.trim() || !corpo.trim() || enviando}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-sm">
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {enviando ? 'Enviando…' : `Disparar para ${contatos.length} contato(s)`}
          </button>
          {status && <span className="text-sm text-nex-gray-600 px-3 py-1.5 rounded-lg bg-nex-gray-50 border border-nex-gray-100">{status}</span>}
        </div>
      )}
    </div>
  )
}
