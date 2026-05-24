'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { TIPOS_PROPOSTA } from '@/types'
import { Presentation, Download, ExternalLink } from 'lucide-react'

const CAMPOS_PROPOSTA: Record<string, { nome: string; label: string; tipo: string; obrigatorio: boolean }[]> = {
  escritorios_privativos: [
    { nome: 'nome_cliente', label: 'Nome / Razão Social', tipo: 'text', obrigatorio: true },
    { nome: 'email_cliente', label: 'E-mail do Cliente', tipo: 'email', obrigatorio: false },
    { nome: 'sala', label: 'Sala Ofertada', tipo: 'text', obrigatorio: true },
    { nome: 'area_m2', label: 'Área (m²)', tipo: 'text', obrigatorio: false },
    { nome: 'valor_mensal', label: 'Valor Mensal (R$)', tipo: 'text', obrigatorio: true },
    { nome: 'condicoes', label: 'Condições Especiais', tipo: 'text', obrigatorio: false },
    { nome: 'validade_proposta', label: 'Validade da Proposta', tipo: 'date', obrigatorio: true },
  ],
  eventos: [
    { nome: 'nome_cliente', label: 'Nome / Empresa', tipo: 'text', obrigatorio: true },
    { nome: 'email_cliente', label: 'E-mail do Cliente', tipo: 'email', obrigatorio: false },
    { nome: 'tipo_evento', label: 'Tipo de Evento', tipo: 'text', obrigatorio: true },
    { nome: 'capacidade', label: 'Capacidade de Pessoas', tipo: 'number', obrigatorio: false },
    { nome: 'valor_hora', label: 'Valor por Hora (R$)', tipo: 'text', obrigatorio: true },
    { nome: 'valor_pacote', label: 'Valor Pacote Fechado (R$)', tipo: 'text', obrigatorio: false },
    { nome: 'validade_proposta', label: 'Validade da Proposta', tipo: 'date', obrigatorio: true },
  ],
}

export default function NovaPropostaPage() {
  const [tipo, setTipo] = useState('')
  const [unidade, setUnidade] = useState('')
  const [campos, setCampos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [gerado, setGerado] = useState<{ pptxUrl?: string; driveUrl?: string } | null>(null)

  const camposModelo = tipo ? (CAMPOS_PROPOSTA[tipo] ?? []) : []

  async function handleGerar() {
    const obrigatoriosFaltando = camposModelo.filter(c => c.obrigatorio && !campos[c.nome])
    if (obrigatoriosFaltando.length > 0) {
      toast({ title: 'Campos obrigatórios', description: `Preencha: ${obrigatoriosFaltando.map(c => c.label).join(', ')}`, variant: 'destructive' })
      return
    }
    if (!unidade) {
      toast({ title: 'Unidade obrigatória', description: 'Selecione a unidade.', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/propostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, unidade, campos }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGerado(data)
      toast({ title: 'Proposta gerada!', description: 'Download iniciado.', variant: 'default' })
      if (data.pptxUrl) {
        const a = document.createElement('a')
        a.href = data.pptxUrl
        a.download = `proposta_${tipo}_${Date.now()}.pptx`
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
      <PageHeader title="Nova Proposta" description="Gere propostas comerciais em .pptx." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração da Proposta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Proposta *</Label>
              <Select value={tipo} onValueChange={v => { setTipo(v); setCampos({}) }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {TIPOS_PROPOSTA.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nex_house">Nex House</SelectItem>
                  <SelectItem value="francisco_rocha">Francisco Rocha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {tipo && camposModelo.length > 0 && (
            <div className="space-y-4 pt-2 border-t">
              <p className="text-sm font-semibold text-nex-gray-600 uppercase tracking-wide">Dados da Proposta</p>
              {camposModelo.map(campo => (
                <div key={campo.nome} className="space-y-1.5">
                  <Label>{campo.label}{campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}</Label>
                  <Input
                    type={campo.tipo}
                    value={campos[campo.nome] ?? ''}
                    onChange={e => setCampos(prev => ({ ...prev, [campo.nome]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}

          <Button
            variant="primary"
            className="w-full"
            onClick={handleGerar}
            disabled={!tipo || !unidade || loading}
          >
            <Presentation className="h-4 w-4" />
            {loading ? 'Gerando...' : 'Gerar Proposta (.pptx)'}
          </Button>

          {gerado && (
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <p className="text-sm text-green-700 font-medium">Proposta gerada com sucesso!</p>
              </div>
              <div className="flex gap-2">
                {gerado.pptxUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={gerado.pptxUrl} download>
                      <Download className="h-4 w-4" /> Baixar .pptx
                    </a>
                  </Button>
                )}
                {gerado.driveUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={gerado.driveUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" /> Ver no Drive
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
