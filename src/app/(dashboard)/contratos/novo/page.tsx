'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSession } from 'next-auth/react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { TIPOS_CONTRATO, TIPOS_ADITIVO } from '@/types'
import { FileText, Download, Plus, ExternalLink } from 'lucide-react'

const CAMPOS_POR_TIPO: Record<string, { nome: string; label: string; tipo: string; obrigatorio: boolean }[]> = {
  escritorio_privativo: [
    { nome: 'nome_cliente', label: 'Nome / Razão Social', tipo: 'text', obrigatorio: true },
    { nome: 'cpf_cnpj', label: 'CPF / CNPJ', tipo: 'text', obrigatorio: true },
    { nome: 'endereco', label: 'Endereço', tipo: 'text', obrigatorio: true },
    { nome: 'sala', label: 'Sala', tipo: 'text', obrigatorio: true },
    { nome: 'unidade', label: 'Unidade', tipo: 'select', obrigatorio: true },
    { nome: 'valor_mensal', label: 'Valor Mensal (R$)', tipo: 'text', obrigatorio: true },
    { nome: 'data_inicio', label: 'Data de Início', tipo: 'date', obrigatorio: true },
    { nome: 'data_fim', label: 'Data de Término', tipo: 'date', obrigatorio: false },
    { nome: 'dia_vencimento', label: 'Dia de Vencimento', tipo: 'number', obrigatorio: true },
  ],
  nex_house: [
    { nome: 'nome_cliente', label: 'Nome / Razão Social', tipo: 'text', obrigatorio: true },
    { nome: 'cpf_cnpj', label: 'CPF / CNPJ', tipo: 'text', obrigatorio: true },
    { nome: 'endereco_cliente', label: 'Endereço do Cliente', tipo: 'text', obrigatorio: true },
    { nome: 'unidade_nex', label: 'Unidade Nex House', tipo: 'text', obrigatorio: true },
    { nome: 'valor_mensal', label: 'Valor Mensal (R$)', tipo: 'text', obrigatorio: true },
    { nome: 'data_inicio', label: 'Data de Início', tipo: 'date', obrigatorio: true },
    { nome: 'dia_vencimento', label: 'Dia de Vencimento', tipo: 'number', obrigatorio: true },
  ],
  escritorio_virtual: [
    { nome: 'nome_cliente', label: 'Nome / Razão Social', tipo: 'text', obrigatorio: true },
    { nome: 'cpf_cnpj', label: 'CPF / CNPJ', tipo: 'text', obrigatorio: true },
    { nome: 'plano', label: 'Plano EV', tipo: 'text', obrigatorio: true },
    { nome: 'valor_mensal', label: 'Valor Mensal (R$)', tipo: 'text', obrigatorio: true },
    { nome: 'data_inicio', label: 'Data de Início', tipo: 'date', obrigatorio: true },
    { nome: 'unidade', label: 'Unidade', tipo: 'select', obrigatorio: true },
  ],
  evento: [
    { nome: 'nome_cliente', label: 'Nome / Empresa', tipo: 'text', obrigatorio: true },
    { nome: 'cpf_cnpj', label: 'CPF / CNPJ', tipo: 'text', obrigatorio: true },
    { nome: 'sala', label: 'Sala do Evento', tipo: 'text', obrigatorio: true },
    { nome: 'data_evento', label: 'Data do Evento', tipo: 'date', obrigatorio: true },
    { nome: 'hora_inicio', label: 'Hora de Início', tipo: 'time', obrigatorio: true },
    { nome: 'hora_fim', label: 'Hora de Término', tipo: 'time', obrigatorio: true },
    { nome: 'valor_total', label: 'Valor Total (R$)', tipo: 'text', obrigatorio: true },
    { nome: 'unidade', label: 'Unidade', tipo: 'select', obrigatorio: true },
  ],
  diaria_reuniao: [
    { nome: 'nome_cliente', label: 'Nome / Empresa', tipo: 'text', obrigatorio: true },
    { nome: 'sala', label: 'Sala', tipo: 'text', obrigatorio: true },
    { nome: 'data', label: 'Data', tipo: 'date', obrigatorio: true },
    { nome: 'hora_inicio', label: 'Hora de Início', tipo: 'time', obrigatorio: true },
    { nome: 'hora_fim', label: 'Hora de Término', tipo: 'time', obrigatorio: true },
    { nome: 'valor', label: 'Valor (R$)', tipo: 'text', obrigatorio: true },
    { nome: 'unidade', label: 'Unidade', tipo: 'select', obrigatorio: true },
  ],
  diaria_trabalho: [
    { nome: 'nome_cliente', label: 'Nome', tipo: 'text', obrigatorio: true },
    { nome: 'cpf', label: 'CPF', tipo: 'text', obrigatorio: true },
    { nome: 'data_inicio', label: 'Data de Início', tipo: 'date', obrigatorio: true },
    { nome: 'quantidade_dias', label: 'Quantidade de Dias', tipo: 'number', obrigatorio: true },
    { nome: 'valor_diaria', label: 'Valor por Diária (R$)', tipo: 'text', obrigatorio: true },
    { nome: 'unidade', label: 'Unidade', tipo: 'select', obrigatorio: true },
  ],
}

const CAMPOS_ADITIVO: Record<string, { nome: string; label: string; tipo: string; obrigatorio: boolean }[]> = {
  pf_pj: [
    { nome: 'cnpj_novo', label: 'CNPJ da Empresa', tipo: 'text', obrigatorio: true },
    { nome: 'razao_social', label: 'Razão Social', tipo: 'text', obrigatorio: true },
    { nome: 'data_aditivo', label: 'Data do Aditivo', tipo: 'date', obrigatorio: true },
  ],
  troca_endereco: [
    { nome: 'endereco_novo', label: 'Novo Endereço', tipo: 'text', obrigatorio: true },
    { nome: 'data_mudanca', label: 'Data da Mudança', tipo: 'date', obrigatorio: true },
    { nome: 'motivo', label: 'Motivo', tipo: 'text', obrigatorio: false },
  ],
}

export default function NovoContratoPage() {
  const { data: session } = useSession()
  const [tipoDoc, setTipoDoc] = useState('')
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [gerado, setGerado] = useState<{ docUrl?: string; driveUrl?: string; documentoId?: string } | null>(null)
  const [mostraAditivo, setMostraAditivo] = useState(false)
  const [tipoAditivo, setTipoAditivo] = useState('')
  const [aditivoValues, setAditivoValues] = useState<Record<string, string>>({})
  const [aditivoGerado, setAditivoGerado] = useState<{ docUrl?: string; driveUrl?: string } | null>(null)

  const campos = tipoDoc ? (CAMPOS_POR_TIPO[tipoDoc] ?? []) : []
  const camposAditivo = tipoAditivo ? (CAMPOS_ADITIVO[tipoAditivo] ?? []) : []

  async function handleGerar() {
    const obrigatoriosFaltando = campos.filter(c => c.obrigatorio && !formValues[c.nome])
    if (obrigatoriosFaltando.length > 0) {
      toast({ title: 'Campos obrigatórios', description: `Preencha: ${obrigatoriosFaltando.map(c => c.label).join(', ')}`, variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tipoDoc, campos: formValues }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGerado(data)
      toast({ title: 'Documento gerado!', description: 'Download iniciado automaticamente.', variant: 'default' })
      if (data.docUrl) {
        const a = document.createElement('a')
        a.href = data.docUrl
        a.download = `contrato_${tipoDoc}_${Date.now()}.docx`
        a.click()
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleGerarAditivo() {
    const obrigatoriosFaltando = camposAditivo.filter(c => c.obrigatorio && !aditivoValues[c.nome])
    if (obrigatoriosFaltando.length > 0) {
      toast({ title: 'Campos obrigatórios', description: `Preencha: ${obrigatoriosFaltando.map(c => c.label).join(', ')}`, variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/contratos/aditivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: tipoAditivo,
          camposContrato: formValues,
          camposAditivo: aditivoValues,
          documentoOrigemId: gerado?.documentoId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAditivoGerado(data)
      toast({ title: 'Aditivo gerado!', description: 'Download iniciado.', variant: 'default' })
      if (data.docUrl) {
        const a = document.createElement('a')
        a.href = data.docUrl
        a.download = `aditivo_${tipoAditivo}_${Date.now()}.docx`
        a.click()
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Novo Contrato" description="Gere contratos e termos padronizados." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipo de Documento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Selecione o tipo *</Label>
            <Select value={tipoDoc} onValueChange={(v) => { setTipoDoc(v); setFormValues({}); setGerado(null) }}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o tipo de documento..." />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_CONTRATO.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipoDoc && campos.length > 0 && (
            <div className="space-y-4 pt-2 border-t">
              <p className="text-sm font-semibold text-nex-gray-600 uppercase tracking-wide">Dados do documento</p>
              {campos.map(campo => (
                <div key={campo.nome} className="space-y-1.5">
                  <Label>{campo.label}{campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}</Label>
                  {campo.tipo === 'select' ? (
                    <Select
                      value={formValues[campo.nome] ?? ''}
                      onValueChange={v => setFormValues(prev => ({ ...prev, [campo.nome]: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Nex House">Nex House</SelectItem>
                        <SelectItem value="Francisco Rocha">Francisco Rocha</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={campo.tipo}
                      value={formValues[campo.nome] ?? ''}
                      onChange={e => setFormValues(prev => ({ ...prev, [campo.nome]: e.target.value }))}
                    />
                  )}
                </div>
              ))}

              <Button
                variant="primary"
                className="w-full mt-4"
                onClick={handleGerar}
                disabled={loading}
              >
                <FileText className="h-4 w-4" />
                {loading ? 'Gerando...' : 'Gerar Documento'}
              </Button>
            </div>
          )}

          {gerado && (
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <p className="text-sm text-green-700 font-medium">Documento gerado com sucesso!</p>
              </div>

              <div className="flex gap-2">
                {gerado.docUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={gerado.docUrl} download>
                      <Download className="h-4 w-4" />
                      Baixar .docx
                    </a>
                  </Button>
                )}
                {gerado.driveUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={gerado.driveUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Ver no Drive
                    </a>
                  </Button>
                )}
              </div>

              {!mostraAditivo && (
                <Button
                  variant="secondary"
                  onClick={() => setMostraAditivo(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4" />
                  Gerar Aditivo
                </Button>
              )}
            </div>
          )}

          {mostraAditivo && (
            <div className="pt-4 border-t space-y-4">
              <p className="text-sm font-semibold text-nex-gray-600 uppercase tracking-wide">Aditivo Contratual</p>

              <div className="space-y-2">
                <Label>Tipo de Aditivo *</Label>
                <Select value={tipoAditivo} onValueChange={v => { setTipoAditivo(v); setAditivoValues({}) }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha o tipo de aditivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_ADITIVO.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {tipoAditivo && (
                <>
                  <div className="p-3 bg-nex-gray-50 rounded-md text-sm text-nex-gray-600">
                    Dados do contrato original já estão incorporados no aditivo.
                  </div>

                  {camposAditivo.map(campo => (
                    <div key={campo.nome} className="space-y-1.5">
                      <Label>{campo.label}{campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}</Label>
                      <Input
                        type={campo.tipo}
                        value={aditivoValues[campo.nome] ?? ''}
                        onChange={e => setAditivoValues(prev => ({ ...prev, [campo.nome]: e.target.value }))}
                      />
                    </div>
                  ))}

                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={handleGerarAditivo}
                    disabled={loading}
                  >
                    <FileText className="h-4 w-4" />
                    {loading ? 'Gerando...' : 'Gerar Aditivo'}
                  </Button>
                </>
              )}

              {aditivoGerado && (
                <div className="flex gap-2 pt-2">
                  {aditivoGerado.docUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={aditivoGerado.docUrl} download>
                        <Download className="h-4 w-4" />
                        Baixar Aditivo
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
