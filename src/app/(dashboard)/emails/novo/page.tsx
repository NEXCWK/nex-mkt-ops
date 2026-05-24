'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { MODELOS_EMAIL, COPIAS_FIXAS, COPIAS_POR_UNIDADE, type Unidade } from '@/types'
import { Mail, Send, CheckCircle } from 'lucide-react'

const CAMPOS_POR_MODELO: Record<string, { nome: string; label: string; tipo: string; obrigatorio: boolean }[]> = {
  bastao_eventos: [
    { nome: 'nome_cliente', label: 'Nome / Empresa', tipo: 'text', obrigatorio: true },
    { nome: 'sala', label: 'Sala', tipo: 'text', obrigatorio: true },
    { nome: 'data_evento', label: 'Data do Evento', tipo: 'date', obrigatorio: true },
    { nome: 'hora_inicio', label: 'Hora de Início', tipo: 'time', obrigatorio: true },
    { nome: 'hora_fim', label: 'Hora de Término', tipo: 'time', obrigatorio: true },
    { nome: 'valor_total', label: 'Valor Total', tipo: 'text', obrigatorio: true },
    { nome: 'observacoes', label: 'Observações', tipo: 'textarea', obrigatorio: false },
  ],
  bastao_novo_cliente: [
    { nome: 'nome_cliente', label: 'Nome do Cliente', tipo: 'text', obrigatorio: true },
    { nome: 'empresa', label: 'Empresa', tipo: 'text', obrigatorio: false },
    { nome: 'data_reuniao', label: 'Data da Reunião', tipo: 'date', obrigatorio: true },
    { nome: 'hora_inicio', label: 'Hora de Início', tipo: 'time', obrigatorio: true },
    { nome: 'hora_fim', label: 'Hora de Término', tipo: 'time', obrigatorio: true },
    { nome: 'pauta', label: 'Pauta / Assunto', tipo: 'textarea', obrigatorio: true },
    { nome: 'proximo_passo', label: 'Próximo Passo', tipo: 'textarea', obrigatorio: false },
  ],
  bastao_escritorio: [
    { nome: 'nome_cliente', label: 'Nome / Razão Social', tipo: 'text', obrigatorio: true },
    { nome: 'tipo_espaco', label: 'Tipo de Espaço', tipo: 'text', obrigatorio: true },
    { nome: 'sala', label: 'Sala / Mesa', tipo: 'text', obrigatorio: true },
    { nome: 'data_inicio', label: 'Data de Início', tipo: 'date', obrigatorio: true },
    { nome: 'valor_mensal', label: 'Valor Mensal', tipo: 'text', obrigatorio: true },
    { nome: 'informacoes_extras', label: 'Informações Extras', tipo: 'textarea', obrigatorio: false },
  ],
  ev_pf_pj: [
    { nome: 'nome_cliente', label: 'Nome do Cliente', tipo: 'text', obrigatorio: true },
    { nome: 'cnpj', label: 'CNPJ', tipo: 'text', obrigatorio: true },
    { nome: 'razao_social', label: 'Razão Social', tipo: 'text', obrigatorio: true },
    { nome: 'data_aditivo', label: 'Data do Aditivo', tipo: 'date', obrigatorio: true },
  ],
  ev_troca_endereco: [
    { nome: 'nome_cliente', label: 'Nome do Cliente', tipo: 'text', obrigatorio: true },
    { nome: 'endereco_novo', label: 'Novo Endereço', tipo: 'text', obrigatorio: true },
    { nome: 'data_mudanca', label: 'Data da Mudança', tipo: 'date', obrigatorio: true },
  ],
  ev_documentos: [
    { nome: 'nome_cliente', label: 'Nome do Cliente', tipo: 'text', obrigatorio: true },
    { nome: 'documentos', label: 'Documentos Enviados', tipo: 'textarea', obrigatorio: true },
    { nome: 'observacoes', label: 'Observações', tipo: 'textarea', obrigatorio: false },
  ],
}

const TEMPLATES_CORPO: Record<string, (campos: Record<string, string>, unidade: string) => string> = {
  bastao_eventos: (c, u) => `<p>Olá equipe,</p>
<p>Segue passagem de bastão referente ao evento realizado na unidade <strong>${u}</strong>.</p>
<p><strong>Cliente:</strong> ${c.nome_cliente || '—'}<br/>
<strong>Sala:</strong> ${c.sala || '—'}<br/>
<strong>Data:</strong> ${c.data_evento || '—'}<br/>
<strong>Horário:</strong> ${c.hora_inicio || '—'} às ${c.hora_fim || '—'}<br/>
<strong>Valor Total:</strong> R$ ${c.valor_total || '—'}</p>
${c.observacoes ? `<p><strong>Observações:</strong> ${c.observacoes}</p>` : ''}
<p>Qualquer dúvida, estou à disposição.</p>`,

  bastao_novo_cliente: (c, u) => `<p>Olá equipe,</p>
<p>Seguem as informações da reunião realizada hoje na unidade <strong>${u}</strong>.</p>
<p><strong>Cliente:</strong> ${c.nome_cliente || '—'}<br/>
${c.empresa ? `<strong>Empresa:</strong> ${c.empresa}<br/>` : ''}
<strong>Data:</strong> ${c.data_reuniao || '—'}<br/>
<strong>Horário:</strong> ${c.hora_inicio || '—'} às ${c.hora_fim || '—'}</p>
<p><strong>Pauta:</strong><br/>${c.pauta || '—'}</p>
${c.proximo_passo ? `<p><strong>Próximo Passo:</strong><br/>${c.proximo_passo}</p>` : ''}
<p>Fico à disposição para qualquer informação adicional.</p>`,

  bastao_escritorio: (c, u) => `<p>Olá equipe,</p>
<p>Comunicamos a entrada de novo cliente na unidade <strong>${u}</strong>.</p>
<p><strong>Cliente:</strong> ${c.nome_cliente || '—'}<br/>
<strong>Tipo de Espaço:</strong> ${c.tipo_espaco || '—'}<br/>
<strong>Local:</strong> ${c.sala || '—'}<br/>
<strong>Início do Contrato:</strong> ${c.data_inicio || '—'}<br/>
<strong>Valor Mensal:</strong> R$ ${c.valor_mensal || '—'}</p>
${c.informacoes_extras ? `<p><strong>Informações:</strong> ${c.informacoes_extras}</p>` : ''}
<p>Ficam todos cientes.</p>`,

  ev_pf_pj: (c, u) => `<p>Prezado(a) ${c.nome_cliente || ''},</p>
<p>Informamos que a alteração cadastral de Pessoa Física para Pessoa Jurídica foi processada com sucesso.</p>
<p><strong>CNPJ:</strong> ${c.cnpj || '—'}<br/>
<strong>Razão Social:</strong> ${c.razao_social || '—'}<br/>
<strong>Data do Aditivo:</strong> ${c.data_aditivo || '—'}</p>
<p>O aditivo contratual está em anexo para sua conferência. Em caso de dúvidas, estamos à disposição.</p>`,

  ev_troca_endereco: (c, u) => `<p>Prezado(a) ${c.nome_cliente || ''},</p>
<p>Confirmamos a atualização do endereço fiscal em nosso sistema.</p>
<p><strong>Novo Endereço:</strong> ${c.endereco_novo || '—'}<br/>
<strong>Data da Mudança:</strong> ${c.data_mudanca || '—'}</p>
<p>Qualquer documento enviado após esta data constará o novo endereço.</p>`,

  ev_documentos: (c, u) => `<p>Prezado(a) ${c.nome_cliente || ''},</p>
<p>Segue o envio dos documentos solicitados.</p>
<p><strong>Documentos:</strong><br/>${c.documentos || '—'}</p>
${c.observacoes ? `<p><strong>Observações:</strong> ${c.observacoes}</p>` : ''}
<p>Qualquer dúvida estamos à disposição.</p>`,
}

type Step = 'form' | 'review' | 'sent'

export default function NovoEmailPage() {
  const { data: session } = useSession()
  const [modelo, setModelo] = useState('')
  const [unidade, setUnidade] = useState<Unidade | ''>('')
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [destinatario, setDestinatario] = useState('')
  const [assunto, setAssunto] = useState('')
  const [corpoEditado, setCorpoEditado] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)

  const modeloInfo = MODELOS_EMAIL.find(m => m.value === modelo)
  const camposModelo = modelo ? (CAMPOS_POR_MODELO[modelo] ?? []) : []
  const copias = unidade
    ? [...COPIAS_FIXAS, COPIAS_POR_UNIDADE[unidade as Unidade]]
    : [...COPIAS_FIXAS]

  function handleGerarPreview() {
    const obrigatoriosFaltando = camposModelo.filter(c => c.obrigatorio && !campos[c.nome])
    if (obrigatoriosFaltando.length > 0) {
      toast({ title: 'Campos obrigatórios', description: `Preencha: ${obrigatoriosFaltando.map(c => c.label).join(', ')}`, variant: 'destructive' })
      return
    }
    if (!destinatario) {
      toast({ title: 'Destinatário obrigatório', description: 'Informe o e-mail do destinatário.', variant: 'destructive' })
      return
    }
    if (!assunto) {
      toast({ title: 'Assunto obrigatório', description: 'Informe o assunto do e-mail.', variant: 'destructive' })
      return
    }
    const unidadeLabel = unidade === 'nex_house' ? 'Nex House' : unidade === 'francisco_rocha' ? 'Francisco Rocha' : ''
    const corpo = TEMPLATES_CORPO[modelo]?.(campos, unidadeLabel) ?? ''
    setCorpoEditado(corpo)
    setStep('review')
  }

  async function handleEnviar() {
    setLoading(true)
    try {
      const res = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelo,
          unidade,
          campos,
          destinatario,
          assunto,
          corpo: corpoEditado,
          copias,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStep('sent')
      toast({ title: 'E-mail enviado!', description: `Enviado para ${destinatario}`, variant: 'default' })
    } catch (e: any) {
      toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (step === 'sent') {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Novo E-mail" />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <h2 className="text-xl font-semibold">E-mail enviado com sucesso!</h2>
            <p className="text-sm text-nex-gray-500 text-center">
              Enviado para <strong>{destinatario}</strong> com cópias para {copias.join(', ')}.
              <br />O registro foi salvo no log.
            </p>
            <Button
              variant="primary"
              onClick={() => { setModelo(''); setUnidade(''); setCampos({}); setDestinatario(''); setAssunto(''); setStep('form') }}
            >
              Enviar novo e-mail
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Novo E-mail" description="Selecione o modelo, preencha os campos e envie." />

      {step === 'form' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuração do E-mail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Modelo de E-mail *</Label>
              <Select value={modelo} onValueChange={v => { setModelo(v); setCampos({}) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o modelo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" disabled>Bastões</SelectItem>
                  {MODELOS_EMAIL.filter(m => m.tipo === 'bastao').map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                  <SelectItem value="" disabled>E-mails EV</SelectItem>
                  {MODELOS_EMAIL.filter(m => m.tipo === 'ev').map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Select value={unidade} onValueChange={v => setUnidade(v as Unidade)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nex_house">Nex House</SelectItem>
                  <SelectItem value="francisco_rocha">Francisco Rocha</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Destinatário (e-mail principal) *</Label>
              <Input
                type="email"
                placeholder="cliente@email.com"
                value={destinatario}
                onChange={e => setDestinatario(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Assunto *</Label>
              <Input
                placeholder="Assunto do e-mail"
                value={assunto}
                onChange={e => setAssunto(e.target.value)}
              />
            </div>

            {unidade && (
              <div className="p-3 bg-nex-gray-50 rounded-md">
                <p className="text-xs text-nex-gray-500 mb-2 font-medium">Cópias automáticas:</p>
                <div className="flex flex-wrap gap-1">
                  {copias.map(c => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </div>
            )}

            {modelo && camposModelo.length > 0 && (
              <div className="space-y-4 pt-2 border-t">
                <p className="text-sm font-semibold text-nex-gray-600 uppercase tracking-wide">Dados do e-mail</p>
                {camposModelo.map(campo => (
                  <div key={campo.nome} className="space-y-1.5">
                    <Label>{campo.label}{campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}</Label>
                    {campo.tipo === 'textarea' ? (
                      <Textarea
                        value={campos[campo.nome] ?? ''}
                        onChange={e => setCampos(prev => ({ ...prev, [campo.nome]: e.target.value }))}
                        rows={3}
                      />
                    ) : (
                      <Input
                        type={campo.tipo}
                        value={campos[campo.nome] ?? ''}
                        onChange={e => setCampos(prev => ({ ...prev, [campo.nome]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="primary"
              className="w-full"
              onClick={handleGerarPreview}
              disabled={!modelo || !unidade}
            >
              <Mail className="h-4 w-4" />
              Gerar Prévia
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'review' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revisar e Enviar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3 p-4 bg-nex-gray-50 rounded-md text-sm">
              <div className="flex gap-2">
                <span className="font-medium w-24 text-nex-gray-500">Remetente:</span>
                <span>{session?.user?.email}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium w-24 text-nex-gray-500">Para:</span>
                <span>{destinatario}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-medium w-24 text-nex-gray-500">Cópias:</span>
                <div className="flex flex-wrap gap-1">
                  {copias.map(c => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
                </div>
              </div>
              <div className="flex gap-2">
                <span className="font-medium w-24 text-nex-gray-500">Assunto:</span>
                <span>{assunto}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Corpo do E-mail (editável)</Label>
              <Textarea
                value={corpoEditado}
                onChange={e => setCorpoEditado(e.target.value)}
                rows={12}
                className="font-mono text-xs"
              />
              <p className="text-xs text-nex-gray-400">Você pode editar o texto acima antes de enviar. As cópias automáticas não podem ser removidas.</p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('form')} className="flex-1">
                Voltar
              </Button>
              <Button variant="primary" onClick={handleEnviar} disabled={loading} className="flex-1">
                <Send className="h-4 w-4" />
                {loading ? 'Enviando...' : 'Enviar E-mail'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
