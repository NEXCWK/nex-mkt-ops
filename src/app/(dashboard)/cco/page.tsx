'use client'

import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Send, Upload, Mail, Loader2, Users } from 'lucide-react'

interface Contato {
  nome: string
  email: string
  empresa: string
}

function parseCSV(texto: string): Contato[] {
  const linhas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (linhas.length === 0) return []
  // detecta separador
  const sep = (linhas[0].includes(';') && !linhas[0].includes(',')) ? ';' : (linhas[0].match(/;/g)?.length ?? 0) > (linhas[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const header = linhas[0].toLowerCase()
  const temHeader = /nome|email|e-mail|empresa/.test(header)
  const cols = temHeader ? linhas[0].split(sep).map(c => c.trim().toLowerCase()) : ['nome', 'email', 'empresa']
  const idxNome = cols.findIndex(c => c.includes('nome'))
  const idxEmail = cols.findIndex(c => c.includes('email') || c.includes('e-mail'))
  const idxEmpresa = cols.findIndex(c => c.includes('empresa'))
  const dados = temHeader ? linhas.slice(1) : linhas
  return dados.map(linha => {
    const p = linha.split(sep).map(c => c.trim())
    return {
      nome: idxNome >= 0 ? p[idxNome] ?? '' : p[0] ?? '',
      email: idxEmail >= 0 ? p[idxEmail] ?? '' : p[1] ?? '',
      empresa: idxEmpresa >= 0 ? p[idxEmpresa] ?? '' : p[2] ?? '',
    }
  }).filter(c => c.email.includes('@'))
}

function aplicar(texto: string, c: Contato): string {
  return texto
    .replace(/\{\{\s*nome\s*\}\}/gi, c.nome || '')
    .replace(/\{\{\s*empresa\s*\}\}/gi, c.empresa || '')
}

export default function CcoPage() {
  const [raw, setRaw] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpo, setCorpo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const contatos = useMemo(() => parseCSV(raw), [raw])
  const preview = contatos[0]

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
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

  return (
    <div>
      <PageHeader title="Sistema CCO" description="Disparo de e-mails em massa para uma base de contatos, com variáveis por contato." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Base */}
        <div className="bg-white border border-nex-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-heading font-semibold text-nex-black flex items-center gap-1.5">
              <Users className="w-4 h-4 text-nex-gray-400" /> Base de contatos
            </h3>
            <label className="flex items-center gap-1.5 text-xs text-nex-gray-500 hover:text-nex-black cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Importar CSV
              <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} className="hidden" />
            </label>
          </div>
          <textarea
            value={raw}
            onChange={e => setRaw(e.target.value)}
            rows={12}
            placeholder={'nome,email,empresa\nJoão Silva,joao@empresa.com,Empresa X\nMaria,maria@abc.com,ABC Ltda'}
            className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-nex-gray-400"
          />
          <p className="text-[11px] text-nex-gray-400 mt-2">
            {contatos.length} contato(s) válido(s) detectado(s). Colunas aceitas: nome, email, empresa (com ou sem cabeçalho).
          </p>
        </div>

        {/* E-mail */}
        <div className="bg-white border border-nex-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-heading font-semibold text-nex-black mb-3 flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-nex-gray-400" /> Mensagem
          </h3>
          <p className="text-[11px] text-nex-gray-400 mb-3">
            Variáveis: <code className="px-1 bg-nex-gray-100 rounded">{'{{nome}}'}</code>{' '}
            <code className="px-1 bg-nex-gray-100 rounded">{'{{empresa}}'}</code>. Envio via <strong>comercial@nexcoworking.com.br</strong>.
          </p>
          <input value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Assunto"
            className="w-full rounded-lg border border-nex-gray-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
          <textarea value={corpo} onChange={e => setCorpo(e.target.value)} rows={9} placeholder="Olá {{nome}}, ..."
            className="w-full resize-y rounded-lg border border-nex-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nex-gray-400" />
        </div>
      </div>

      {preview && (
        <div className="mt-5 p-4 rounded-xl bg-nex-gray-50 border border-nex-gray-100 max-w-3xl">
          <p className="text-[11px] uppercase tracking-wide text-nex-gray-400 mb-1">Prévia ({preview.email})</p>
          <p className="text-sm font-heading font-medium text-nex-gray-800 mb-1">{aplicar(assunto, preview)}</p>
          <p className="text-sm text-nex-gray-600 whitespace-pre-wrap">{aplicar(corpo, preview)}</p>
        </div>
      )}

      <div className="flex items-center gap-3 mt-5">
        <button onClick={enviar} disabled={contatos.length === 0 || !assunto.trim() || !corpo.trim() || enviando}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nex-black text-white text-sm font-heading font-medium hover:bg-nex-gray-700 disabled:opacity-40 disabled:pointer-events-none transition-colors">
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {enviando ? 'Enviando…' : `Disparar para ${contatos.length} contato(s)`}
        </button>
        {status && <span className="text-sm text-nex-gray-600">{status}</span>}
      </div>
    </div>
  )
}
