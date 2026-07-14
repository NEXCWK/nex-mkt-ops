'use client'

import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Send, Upload, Mail, Loader2, Users, User, Check } from 'lucide-react'
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Base */}
        <div className="bg-white border border-nex-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-heading font-semibold text-nex-black flex items-center gap-1.5">
              <Users className="w-4 h-4 text-nex-gray-400" /> Base de contatos
            </h3>
            <label className="flex items-center gap-1.5 text-xs text-nex-gray-500 hover:text-nex-black cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Importar CSV ou Excel
              <input type="file" accept=".csv,text/csv,text/plain,.xls,.xlsx" onChange={onFile} className="hidden" />
            </label>
          </div>
          <textarea
            value={raw}
            onChange={e => setRaw(e.target.value)}
            rows={12}
            placeholder={'nome,email,empresa,produto\nJoão Silva,joao@empresa.com,Empresa X,Escritório Privativo\nMaria,maria@abc.com,ABC Ltda,Sala de Reunião'}
            className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-nex-gray-400"
          />
          <p className="text-[11px] text-nex-gray-400 mt-2">
            {contatos.length} contato(s) válido(s) detectado(s). Colunas: nome, email, empresa, produto (com ou sem cabeçalho). Cole o texto, ou importe um arquivo .csv ou .xls/.xlsx acima.
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
                    <tr key={i} className="border-t border-nex-gray-50">
                      <td className="py-1.5 pr-2">
                        <div className="font-medium text-nex-gray-800">{c.empresa || c.nome}</div>
                        <div className="text-nex-gray-400">{c.nome} · {c.email}</div>
                      </td>
                      <td className="py-1.5 pr-2 text-nex-gray-500">{c.produto || '—'}</td>
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
        </div>

        {/* E-mail */}
        <div className="bg-white border border-nex-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <h3 className="text-sm font-heading font-semibold text-nex-black flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-nex-gray-400" /> Mensagem
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
            Variáveis: <code className="px-1 bg-nex-gray-100 rounded">{'{{nome}}'}</code>{' '}
            <code className="px-1 bg-nex-gray-100 rounded">{'{{empresa}}'}</code>{' '}
            <code className="px-1 bg-nex-gray-100 rounded">{'{{produto}}'}</code>. Envio via <strong>comercial@nex.work</strong>.
          </p>
          <input value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Assunto"
            className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          <textarea value={corpo} onChange={e => setCorpo(e.target.value)} rows={9} placeholder="Olá {{nome}}, sobre o seu {{produto}} na {{empresa}}…"
            className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
        </div>
      </div>

      {/* Painel de edição individual */}
      {editandoIdx !== null && (
        <div className="mt-5 bg-white border border-nex-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-heading font-semibold text-nex-black mb-3 flex items-center gap-1.5">
            <User className="w-4 h-4 text-nex-gray-400" /> Enviar para {contatos[editandoIdx]?.empresa || contatos[editandoIdx]?.nome}
          </h3>
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
        </div>
      )}

      {preview && (
        <div className="mt-5 p-4 rounded-xl bg-nex-gray-50 border border-nex-gray-100 max-w-3xl">
          <p className="text-[11px] uppercase tracking-wide text-nex-gray-400 mb-1">Prévia ({preview.email})</p>
          <p className="text-sm font-heading font-medium text-nex-gray-800 mb-1">{aplicar(assunto, preview)}</p>
          <p className="text-sm text-nex-gray-600 whitespace-pre-wrap">{aplicar(corpo, preview)}</p>
        </div>
      )}

      {modoEnvio === 'massa' && (
        <div className="flex items-center gap-3 mt-5">
          <button onClick={enviar} disabled={contatos.length === 0 || !assunto.trim() || !corpo.trim() || enviando}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors">
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {enviando ? 'Enviando…' : `Disparar para ${contatos.length} contato(s)`}
          </button>
          {status && <span className="text-sm text-nex-gray-600">{status}</span>}
        </div>
      )}
    </div>
  )
}
