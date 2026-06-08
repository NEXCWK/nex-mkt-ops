'use client'

import { useState } from 'react'
import { Eye, EyeOff, ExternalLink, Pencil, Check, X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Parceiro = {
  id: string
  nome: string
  sistema: string | null
  login_usuario: string | null
  senha: string | null
  valor_diaria: string | null
  valor_hora: string | null
  contato_email: string | null
  contato_telefone: string | null
  mesas: string | null
  observacoes: string | null
  status: string | null
}

function SenhaField({ value }: { value: string | null }) {
  const [visible, setVisible] = useState(false)
  if (!value) return <span className="text-nex-gray-300">—</span>
  return (
    <span className="flex items-center gap-1.5 font-mono text-xs">
      {visible ? value : '••••••••••'}
      <button onClick={() => setVisible(v => !v)} className="text-nex-gray-400 hover:text-nex-gray-700 transition-colors">
        {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </span>
  )
}

function SistemaLinks({ value }: { value: string | null }) {
  if (!value) return <span className="text-nex-gray-300">—</span>
  const links = value.split('|').map(s => s.trim()).filter(Boolean)
  return (
    <span className="flex flex-wrap gap-2">
      {links.map((link, i) => (
        <a key={i} href={link} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-nex-gray-700 hover:text-nex-black underline underline-offset-2 text-xs transition-colors">
          {link.replace(/https?:\/\//, '').replace(/\/.*/, '')}
          <ExternalLink className="w-3 h-3" />
        </a>
      ))}
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-nex-gray-100 last:border-0">
      <span className="text-[11px] font-extrabold uppercase tracking-widest text-nex-gray-400 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-nex-gray-800 font-bold flex-1 min-w-0 break-words">{children}</span>
    </div>
  )
}

function EditField({ label, value, onChange, multiline }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-extrabold uppercase tracking-widest text-nex-gray-400">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-nex-gray-200 bg-white px-3 py-2 text-sm font-bold placeholder:text-nex-gray-300 focus:outline-none focus:ring-1 focus:ring-nex-gray-400 focus:border-nex-gray-400 resize-none transition-colors"
        />
      ) : (
        <Input value={value} onChange={e => onChange(e.target.value)} />
      )}
    </div>
  )
}

function ParceiroCard({ parceiro, onUpdate, onDelete }: {
  parceiro: Parceiro
  onUpdate: (updated: Parceiro) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(parceiro)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function field(key: keyof Parceiro) {
    return (draft[key] as string) ?? ''
  }
  function set(key: keyof Parceiro) {
    return (v: string) => setDraft(d => ({ ...d, [key]: v }))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/parceiros/${parceiro.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await res.json()
      if (res.ok) { onUpdate(data); setEditing(false) }
    } finally { setSaving(false) }
  }

  async function remove() {
    if (!confirm(`Excluir ${parceiro.nome}?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/parceiros/${parceiro.id}`, { method: 'DELETE' })
      if (res.ok) onDelete(parceiro.id)
    } finally { setDeleting(false) }
  }

  function cancel() { setDraft(parceiro); setEditing(false) }

  return (
    <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-nex-gray-100">
        <h3 className="text-base font-black text-nex-black tracking-tight">{parceiro.nome}</h3>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <Button size="sm" onClick={save} disabled={saving} className="h-7 px-3 text-xs">
                <Check className="w-3.5 h-3.5" /> {saving ? 'Salvando…' : 'Salvar'}
              </Button>
              <Button size="sm" variant="outline" onClick={cancel} className="h-7 px-3 text-xs">
                <X className="w-3.5 h-3.5" /> Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="h-7 px-3 text-xs">
                <Pencil className="w-3.5 h-3.5" /> Editar
              </Button>
              <button onClick={remove} disabled={deleting}
                className="p-1.5 text-nex-gray-300 hover:text-red-500 transition-colors rounded">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <EditField label="Nome" value={field('nome')} onChange={set('nome')} />
          <EditField label="Sistema / URL" value={field('sistema')} onChange={set('sistema')} />
          <EditField label="Login" value={field('login_usuario')} onChange={set('login_usuario')} />
          <EditField label="Senha" value={field('senha')} onChange={set('senha')} />
          <EditField label="Valor Diária" value={field('valor_diaria')} onChange={set('valor_diaria')} />
          <EditField label="Valor Hora" value={field('valor_hora')} onChange={set('valor_hora')} multiline />
          <EditField label="E-mail Contato" value={field('contato_email')} onChange={set('contato_email')} />
          <EditField label="Telefone Contato" value={field('contato_telefone')} onChange={set('contato_telefone')} />
          <EditField label="Mesas Disponíveis" value={field('mesas')} onChange={set('mesas')} />
          <EditField label="Observações" value={field('observacoes')} onChange={set('observacoes')} multiline />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-nex-gray-100">
          {/* Coluna esquerda — Acesso */}
          <div className="px-5 py-4 space-y-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-nex-gray-300 mb-3">Acesso</p>
            <Row label="Sistema"><SistemaLinks value={parceiro.sistema} /></Row>
            <Row label="Login">{parceiro.login_usuario ?? '—'}</Row>
            <Row label="Senha"><SenhaField value={parceiro.senha} /></Row>
          </div>

          {/* Coluna direita — Valores, Contato, Mesas */}
          <div className="px-5 py-4 space-y-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-nex-gray-300 mb-3">Detalhes</p>
            <Row label="Diária">{parceiro.valor_diaria ?? '—'}</Row>
            <Row label="Hora">
              <span className="whitespace-pre-line">{parceiro.valor_hora ?? '—'}</span>
            </Row>
            {parceiro.contato_email && <Row label="E-mail">{parceiro.contato_email}</Row>}
            {parceiro.contato_telefone && <Row label="Telefone">{parceiro.contato_telefone}</Row>}
            {parceiro.mesas && <Row label="Mesas">{parceiro.mesas}</Row>}
            {parceiro.observacoes && (
              <Row label="Obs.">
                <span className="whitespace-pre-line">{parceiro.observacoes}</span>
              </Row>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function ParceirosClient({ initial }: { initial: Parceiro[] }) {
  const [parceiros, setParceiros] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [newDraft, setNewDraft] = useState<Partial<Parceiro>>({ nome: '', status: 'ativo' })
  const [saving, setSaving] = useState(false)

  function handleUpdate(updated: Parceiro) {
    setParceiros(ps => ps.map(p => p.id === updated.id ? updated : p))
  }
  function handleDelete(id: string) {
    setParceiros(ps => ps.filter(p => p.id !== id))
  }

  async function handleAdd() {
    if (!newDraft.nome) return
    setSaving(true)
    try {
      const res = await fetch('/api/parceiros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDraft),
      })
      const data = await res.json()
      if (res.ok) {
        setParceiros(ps => [...ps, data])
        setAdding(false)
        setNewDraft({ nome: '', status: 'ativo' })
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setAdding(a => !a)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Novo Parceiro
        </Button>
      </div>

      {adding && (
        <div className="bg-white border border-nex-gray-200 rounded-xl p-5 space-y-4">
          <p className="text-sm font-black text-nex-black">Novo Parceiro</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['nome', 'sistema', 'login_usuario', 'senha', 'valor_diaria', 'valor_hora',
               'contato_email', 'contato_telefone', 'mesas', 'observacoes'] as const).map(key => (
              <div key={key} className="space-y-1">
                <label className="text-[11px] font-extrabold uppercase tracking-widest text-nex-gray-400">
                  {key.replace(/_/g, ' ')}
                </label>
                <Input
                  value={(newDraft[key] as string) ?? ''}
                  onChange={e => setNewDraft(d => ({ ...d, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              <Check className="w-3.5 h-3.5" /> {saving ? 'Salvando…' : 'Salvar'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>
              <X className="w-3.5 h-3.5" /> Cancelar
            </Button>
          </div>
        </div>
      )}

      {parceiros.length === 0 && !adding && (
        <div className="text-center py-16 text-nex-gray-400 text-sm font-bold">
          Nenhum parceiro cadastrado ainda.
        </div>
      )}

      {parceiros.map(p => (
        <ParceiroCard key={p.id} parceiro={p} onUpdate={handleUpdate} onDelete={handleDelete} />
      ))}
    </div>
  )
}
