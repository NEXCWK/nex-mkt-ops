'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  EMAIL_TEMPLATES, GRUPOS, MARCADORES_DEF,
  substituir, getCamposGlobais, getCamposContextuais,
  type CampoMarcador,
} from './templates-data'
import { cn } from '@/lib/utils'
import { Copy, Check, AlertTriangle, ImageOff, Mail } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

// ── html helpers ──────────────────────────────────────────────────────────────

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function isSecaoMaiuscula(linha: string): boolean {
  if (!linha.trim()) return false
  // tem ao menos uma letra e todas as letras são maiúsculas
  if (!/[a-záéíóúâêôãõçàü]/i.test(linha)) return false
  return linha === linha.toUpperCase()
}

function textToEmailHtml(text: string, assinaturaUrl?: string | null): string {
  const paragrafos = text.split(/\n\n+/)

  const partes = paragrafos.map(p => {
    if (!p.trim()) return ''
    const linhas = p.split('\n')

    // parágrafo de lista: todas linhas com '- ' ou vazias
    if (linhas.length > 1 && linhas.every(l => l.startsWith('- ') || !l.trim())) {
      const itens = linhas
        .filter(l => l.startsWith('- '))
        .map(l => `<li style="margin:0 0 5px 0">${escHtml(l.slice(2))}</li>`)
        .join('')
      return `<ul style="margin:0 0 14px 0;padding-left:20px">${itens}</ul>`
    }

    // parágrafo normal
    const htmlLinhas = linhas.map(linha => {
      if (!linha) return ''
      if (isSecaoMaiuscula(linha)) return `<strong>${escHtml(linha)}</strong>`
      return escHtml(linha)
    })

    return `<p style="margin:0 0 14px 0">${htmlLinhas.join('<br>')}</p>`
  }).filter(Boolean)

  const corpo = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:normal;color:#202124;line-height:1.65">${partes.join('')}</div>`

  if (assinaturaUrl) {
    return corpo + `<img src="${assinaturaUrl}" style="display:block;max-height:96px;margin-top:4px" alt="">`
  }

  return corpo
}

async function copyHtml(text: string, html: string) {
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ])
  } catch {
    await navigator.clipboard.writeText(text)
  }
}

// ── hooks ─────────────────────────────────────────────────────────────────────

function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])
  return { copy, copied }
}

function useCopyCorpo(text: string, assinaturaUrl?: string | null) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async () => {
    const html = textToEmailHtml(text, assinaturaUrl)
    await copyHtml(text, html)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text, assinaturaUrl])
  return { copy, copied }
}

// ── campo input ───────────────────────────────────────────────────────────────

function CampoInput({ campo, value, onChange }: {
  campo: CampoMarcador
  value: string
  onChange: (v: string) => void
}) {
  if (campo.tipo === 'selecao' && campo.opcoes) {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-9 rounded-md border border-nex-gray-200 bg-white px-3 text-sm font-bold text-nex-black focus:outline-none focus:ring-1 focus:ring-nex-gray-400 focus:border-nex-gray-400 transition-colors"
      >
        <option value="">Selecionar...</option>
        {campo.opcoes.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  if (campo.tipo === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={campo.nome === 'assinatura' ? 4 : 3}
        placeholder={campo.nome === 'assinatura' ? 'Nome\nCargo\nE-mail | Telefone' : ''}
        className="w-full rounded-md border border-nex-gray-200 bg-white px-3 py-2 text-sm font-bold placeholder:text-nex-gray-300 placeholder:font-bold focus:outline-none focus:ring-1 focus:ring-nex-gray-400 focus:border-nex-gray-400 resize-none transition-colors"
      />
    )
  }
  return (
    <Input
      type={campo.tipo === 'data' ? 'date' : 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={campo.label}
    />
  )
}

// ── preview renderer ──────────────────────────────────────────────────────────

function renderInline(text: string) {
  const parts = text.split(/(\{\{[^}]+\}\})/g)
  return parts.map((part, i) =>
    /^\{\{[^}]+\}\}$/.test(part)
      ? <span key={i} className="bg-amber-100 text-amber-700 font-extrabold rounded px-0.5">{part}</span>
      : <span key={i}>{part}</span>
  )
}

function RenderBody({ text }: { text: string }) {
  if (!text) {
    return <p className="text-sm text-nex-gray-300">O corpo do e-mail aparecerá aqui...</p>
  }

  const paragrafos = text.split(/\n\n+/)

  return (
    <>
      {paragrafos.map((p, pi) => {
        if (!p.trim()) return null
        const linhas = p.split('\n')

        // lista
        if (linhas.length > 1 && linhas.every(l => l.startsWith('- ') || !l.trim())) {
          return (
            <ul key={pi} className="list-disc ml-5 mb-3 space-y-0.5">
              {linhas.filter(l => l.startsWith('- ')).map((l, li) => (
                <li key={li} className="text-sm text-nex-gray-800">{renderInline(l.slice(2))}</li>
              ))}
            </ul>
          )
        }

        // parágrafo normal
        return (
          <p key={pi} className="mb-3 leading-relaxed">
            {linhas.map((linha, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {isSecaoMaiuscula(linha)
                  ? <strong className="font-extrabold text-nex-black">{renderInline(linha)}</strong>
                  : <span className="text-sm text-nex-gray-800">{renderInline(linha)}</span>
                }
              </span>
            ))}
          </p>
        )
      })}
    </>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function NovoEmailPage() {
  const { data: session } = useSession()
  const [grupoAtivo, setGrupoAtivo] = useState<string>(GRUPOS[0])
  const [templateId, setTemplateId] = useState<string>('')
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/usuario/perfil')
      .then(r => r.json())
      .then(d => setAssinaturaUrl(d.assinatura_url ?? null))
  }, [])

  // Pré-preenche nome do atendente com o usuário logado
  useEffect(() => {
    if (session?.user?.name) {
      setCampos(prev => prev.nome_atendente ? prev : { ...prev, nome_atendente: session.user.name! })
    }
  }, [session?.user?.name])

  const template = EMAIL_TEMPLATES.find(t => t.id === templateId) ?? null
  const globais = getCamposGlobais()
  const contextuais = template ? getCamposContextuais(template) : []

  function setVal(nome: string, val: string) {
    setCampos(prev => ({ ...prev, [nome]: val }))
  }

  const assuntoGerado = useMemo(() =>
    template ? substituir(template.assunto, campos) : '',
    [template, campos]
  )

  const corpoGerado = useMemo(() =>
    template ? substituir(template.corpo, campos) : '',
    [template, campos]
  )

  const copyAssunto = useCopy(assuntoGerado)

  const assinaturaParaCopia = template?.marcadores.includes('assinatura') ? assinaturaUrl : null
  const copyCorpo = useCopyCorpo(corpoGerado, assinaturaParaCopia)

  const templatesDoGrupo = EMAIL_TEMPLATES.filter(t => t.grupo === grupoAtivo)
  const pendentes = template ? template.marcadores.filter(m => !campos[m]) : []

  return (
    <div>
      <PageHeader
        title="Novo E-mail"
        description="Selecione um template, preencha os campos e copie o e-mail gerado."
      />

      {/* ── Template Selector ── */}
      <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden mb-5">
        <div className="flex border-b border-nex-gray-100 overflow-x-auto">
          {GRUPOS.map(g => (
            <button
              key={g}
              onClick={() => { setGrupoAtivo(g); setTemplateId('') }}
              className={cn(
                'px-5 py-3 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-colors flex-shrink-0',
                grupoAtivo === g
                  ? 'text-nex-black border-b-2 border-nex-black -mb-px bg-white'
                  : 'text-nex-gray-400 hover:text-nex-gray-700 hover:bg-nex-gray-50'
              )}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 p-3">
          {templatesDoGrupo.map(t => (
            <button
              key={t.id}
              onClick={() => setTemplateId(t.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
                templateId === t.id
                  ? 'bg-nex-black text-white'
                  : 'bg-nex-gray-50 text-nex-gray-600 hover:bg-nex-gray-100 hover:text-nex-black border border-nex-gray-200'
              )}
            >
              {t.titulo}
            </button>
          ))}
        </div>
      </div>

      {/* ── Context bar ── */}
      {template && (
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="flex-1 min-w-0 px-4 py-2.5 bg-nex-gray-50 border border-nex-gray-200 rounded-lg">
            <p className="text-[11px] font-black uppercase tracking-widest text-nex-gray-400 mb-0.5">Quando usar</p>
            <p className="text-xs font-bold text-nex-gray-600">{template.trigger}</p>
          </div>
          {template.notaInterna && (
            <div className="flex gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg min-w-0 flex-1">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-amber-600 mb-1">Nota Interna</p>
                <p className="text-xs font-bold text-amber-800 leading-relaxed">{template.notaInterna}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Main: Fields + Preview ── */}
      {template ? (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">

          {/* FIELDS */}
          <div className="space-y-4">
            <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-nex-gray-100">
                <p className="text-xs font-black uppercase tracking-widest text-nex-gray-400">Seus Dados</p>
              </div>
              <div className="p-4 space-y-3">
                {globais.map(campo => (
                  <div key={campo.nome} className="space-y-1">
                    <label className="text-[11px] font-black uppercase tracking-widest text-nex-gray-400">
                      {campo.label}
                    </label>
                    <CampoInput campo={campo} value={campos[campo.nome] ?? ''} onChange={v => setVal(campo.nome, v)} />
                  </div>
                ))}
              </div>
            </div>

            {contextuais.length > 0 && (
              <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-nex-gray-100">
                  <p className="text-xs font-black uppercase tracking-widest text-nex-gray-400">Dados do E-mail</p>
                </div>
                <div className="p-4 space-y-3">
                  {contextuais.map(campo => (
                    <div key={campo.nome} className="space-y-1">
                      <label className="text-[11px] font-black uppercase tracking-widest text-nex-gray-400">
                        {campo.label}
                      </label>
                      <CampoInput campo={campo} value={campos[campo.nome] ?? ''} onChange={v => setVal(campo.nome, v)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendentes.length > 0 && (
              <div className="px-4 py-3 bg-nex-gray-50 border border-nex-gray-200 rounded-lg">
                <p className="text-[11px] font-black uppercase tracking-widest text-nex-gray-400 mb-1.5">
                  Faltam {pendentes.length} campo{pendentes.length > 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {pendentes.map(m => (
                    <span key={m} className="text-[11px] font-bold bg-white border border-nex-gray-200 rounded px-1.5 py-0.5 text-nex-gray-500">
                      {MARCADORES_DEF[m]?.label ?? m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PREVIEW */}
          <div className="sticky top-6">
            <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">

              {/* Header */}
              <div className="px-5 py-3 border-b border-nex-gray-100 bg-nex-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-nex-gray-400" />
                  <span className="text-xs font-black uppercase tracking-widest text-nex-gray-400">Preview</span>
                </div>
                <Button onClick={copyCorpo.copy} size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
                  {copyCorpo.copied
                    ? <><Check className="w-3 h-3 text-green-500" /> Copiado!</>
                    : <><Copy className="w-3 h-3" /> Copiar e-mail</>
                  }
                </Button>
              </div>

              {/* Assunto */}
              {template.assunto && (
                <div className="px-5 py-3 border-b border-nex-gray-100 flex items-center gap-3 group">
                  <span className="text-[11px] font-black uppercase tracking-widest text-nex-gray-400 w-14 flex-shrink-0">Assunto</span>
                  <span className="flex-1 text-sm text-nex-black min-w-0">
                    {assuntoGerado
                      ? renderInline(assuntoGerado)
                      : <span className="text-nex-gray-300">Preencha os campos...</span>
                    }
                  </span>
                  <button
                    onClick={copyAssunto.copy}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] font-bold text-nex-gray-400 hover:text-nex-black flex-shrink-0"
                  >
                    {copyAssunto.copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              )}

              {/* Body */}
              <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
                <RenderBody text={corpoGerado} />

                {/* Assinatura visual */}
                {template.marcadores.includes('assinatura') && (
                  <div className="mt-5 pt-4 border-t border-nex-gray-100">
                    {assinaturaUrl ? (
                      <Image
                        src={assinaturaUrl}
                        alt="Assinatura"
                        width={320}
                        height={100}
                        style={{ maxHeight: 100, width: 'auto', objectFit: 'contain' }}
                        unoptimized
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-nex-gray-300">
                        <ImageOff className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold">
                          Sem assinatura configurada —{' '}
                          <Link href="/perfil" className="underline hover:text-nex-gray-600 transition-colors">
                            adicionar em Perfil
                          </Link>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-nex-gray-200 rounded-xl flex items-center justify-center py-20">
          <p className="text-sm font-bold text-nex-gray-300">Selecione um template acima para começar</p>
        </div>
      )}
    </div>
  )
}
