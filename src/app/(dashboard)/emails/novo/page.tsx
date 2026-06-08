'use client'

import { useState, useMemo, useEffect } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  EMAIL_TEMPLATES, GRUPOS, MARCADORES_DEF,
  substituir, getCamposGlobais, getCamposContextuais,
  type EmailTemplate, type CampoMarcador,
} from './templates-data'
import { cn } from '@/lib/utils'
import { Copy, Check, AlertTriangle, ChevronDown, ChevronRight, ImageOff } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

// ── helpers ──────────────────────────────────────────────────────────────────

function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return { copy, copied }
}

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

// ── main component ────────────────────────────────────────────────────────────

export default function NovoEmailPage() {
  const [templateId, setTemplateId] = useState<string>('')
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/usuario/perfil')
      .then(r => r.json())
      .then(d => setAssinaturaUrl(d.assinatura_url ?? null))
  }, [])

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
  const copyCorpo = useCopy(corpoGerado)

  const templatesPorGrupo = GRUPOS.map(g => ({
    grupo: g,
    templates: EMAIL_TEMPLATES.filter(t => t.grupo === g),
  }))

  return (
    <div>
      <PageHeader title="Novo E-mail" description="Selecione um template, preencha os campos e copie o e-mail gerado." />

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 items-start">

        {/* ── PAINEL ESQUERDO — Seletor + Formulário ── */}
        <div className="space-y-4">

          {/* Seletor de template */}
          <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-nex-gray-100">
              <p className="text-xs font-black uppercase tracking-widest text-nex-gray-400">Template</p>
            </div>
            <div className="divide-y divide-nex-gray-100">
              {templatesPorGrupo.map(({ grupo, templates }) => {
                const open = !collapsed[grupo]
                return (
                  <div key={grupo}>
                    <button
                      onClick={() => setCollapsed(c => ({ ...c, [grupo]: !c[grupo] }))}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-nex-gray-50 transition-colors"
                    >
                      <span className="text-xs font-black uppercase tracking-widest text-nex-gray-500">{grupo}</span>
                      {open ? <ChevronDown className="w-3.5 h-3.5 text-nex-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-nex-gray-400" />}
                    </button>
                    {open && (
                      <div className="pb-1">
                        {templates.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setTemplateId(t.id)}
                            className={cn(
                              'w-full text-left px-4 py-2 text-sm transition-colors',
                              templateId === t.id
                                ? 'bg-nex-gray-100 text-nex-black font-extrabold'
                                : 'text-nex-gray-600 font-bold hover:bg-nex-gray-50 hover:text-nex-black'
                            )}
                          >
                            {t.titulo}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Trigger info */}
          {template && (
            <div className="px-4 py-2.5 bg-nex-gray-50 border border-nex-gray-200 rounded-lg">
              <p className="text-[11px] font-black uppercase tracking-widest text-nex-gray-400 mb-0.5">Quando usar</p>
              <p className="text-xs font-bold text-nex-gray-600">{template.trigger}</p>
            </div>
          )}

          {/* Nota interna */}
          {template?.notaInterna && (
            <div className="flex gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-amber-600 mb-1">Nota Interna</p>
                <p className="text-xs font-bold text-amber-800 leading-relaxed">{template.notaInterna}</p>
              </div>
            </div>
          )}

          {/* Campos globais */}
          {template && (
            <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-nex-gray-100">
                <p className="text-xs font-black uppercase tracking-widest text-nex-gray-400">Seus Dados (globais)</p>
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
          )}

          {/* Campos contextuais */}
          {template && contextuais.length > 0 && (
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
        </div>

        {/* ── PAINEL DIREITO — Preview ── */}
        <div className="sticky top-6 space-y-3">
          {!template ? (
            <div className="bg-white border border-nex-gray-200 rounded-xl flex items-center justify-center py-24">
              <p className="text-sm font-bold text-nex-gray-300">Selecione um template para ver o preview</p>
            </div>
          ) : (
            <>
              {/* Assunto */}
              {template.assunto && (
                <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-nex-gray-100">
                    <p className="text-xs font-black uppercase tracking-widest text-nex-gray-400">Assunto</p>
                    <button
                      onClick={copyAssunto.copy}
                      className="flex items-center gap-1 text-[11px] font-extrabold text-nex-gray-400 hover:text-nex-black transition-colors"
                    >
                      {copyAssunto.copied
                        ? <><Check className="w-3 h-3 text-green-500" /> Copiado</>
                        : <><Copy className="w-3 h-3" /> Copiar</>
                      }
                    </button>
                  </div>
                  <p className="px-4 py-3 text-sm font-bold text-nex-black">{assuntoGerado || <span className="text-nex-gray-300">Preencha os campos...</span>}</p>
                </div>
              )}

              {/* Corpo */}
              <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-nex-gray-100">
                  <p className="text-xs font-black uppercase tracking-widest text-nex-gray-400">Corpo do E-mail</p>
                  <button
                    onClick={copyCorpo.copy}
                    className="flex items-center gap-1 text-[11px] font-extrabold text-nex-gray-400 hover:text-nex-black transition-colors"
                  >
                    {copyCorpo.copied
                      ? <><Check className="w-3 h-3 text-green-500" /> Copiado</>
                      : <><Copy className="w-3 h-3" /> Copiar</>
                    }
                  </button>
                </div>
                <div className="px-4 py-4 max-h-[70vh] overflow-y-auto space-y-4">
                  <pre className="text-sm text-nex-gray-800 font-bold whitespace-pre-wrap leading-relaxed">
                    {corpoGerado.replace(/\{\{(\w+)\}\}/g, (m) => m)}
                  </pre>
                  {/* Assinatura visual */}
                  {template.marcadores.includes('assinatura') && (
                    assinaturaUrl ? (
                      <div className="pt-2 border-t border-nex-gray-100">
                        <Image
                          src={assinaturaUrl}
                          alt="Assinatura"
                          width={320}
                          height={100}
                          style={{ maxHeight: 100, width: 'auto', objectFit: 'contain' }}
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-nex-gray-100 flex items-center gap-2 text-nex-gray-300">
                        <ImageOff className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold">
                          Sem assinatura configurada —{' '}
                          <Link href="/perfil" className="underline hover:text-nex-gray-600 transition-colors">
                            adicionar em Perfil
                          </Link>
                        </span>
                      </div>
                    )
                  )}
                </div>
                <div className="px-4 py-3 border-t border-nex-gray-100 flex justify-end">
                  <Button onClick={copyCorpo.copy} size="sm" variant="outline" className="gap-1.5">
                    {copyCorpo.copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copyCorpo.copied ? 'Copiado!' : 'Copiar E-mail'}
                  </Button>
                </div>
              </div>

              {/* Marcadores não preenchidos */}
              {(() => {
                const pendentes = (template.marcadores).filter(m => !campos[m])
                if (pendentes.length === 0) return null
                return (
                  <div className="px-4 py-2.5 bg-nex-gray-50 border border-nex-gray-200 rounded-lg">
                    <p className="text-[11px] font-black uppercase tracking-widest text-nex-gray-400 mb-1">Campos pendentes</p>
                    <div className="flex flex-wrap gap-1">
                      {pendentes.map(m => (
                        <span key={m} className="text-[11px] font-bold bg-white border border-nex-gray-200 rounded px-1.5 py-0.5 text-nex-gray-500">
                          {'{{'}{m}{'}}'}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
