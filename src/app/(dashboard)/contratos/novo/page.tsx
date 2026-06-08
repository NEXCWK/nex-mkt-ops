'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { TIPOS_CONTRATO, TIPOS_ADITIVO } from '@/types'
import { FileText, Download, Plus, ExternalLink, Info } from 'lucide-react'

// ─────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────
type Campo = {
  nome: string
  label: string
  tipo: 'text' | 'date' | 'time' | 'number' | 'select' | 'textarea'
  obrigatorio: boolean
  opcoes?: string[]
  placeholder?: string
  ajuda?: string
}

// ─────────────────────────────────────────────────────────
// Constantes EV
// ─────────────────────────────────────────────────────────
const EV_VALORES_FISCAL: Record<string, string> = {
  'Mensal': 'R$ 169,00',
  'Semestral': 'R$ 699,00',
  'Anual à vista': 'R$ 1.199,00',
  'Anual parcelado': 'R$ 1.349,00',
}
const EV_VALORES_COMERCIAL: Record<string, string> = {
  'Mensal': 'R$ 112,00',
  'Semestral': 'R$ 465,00',
  'Anual à vista': 'R$ 799,00',
  'Anual parcelado': 'R$ 1.038,00',
}

// TODO: atualizar telefone e email das unidades
const EV_UNIDADES_COMERCIAL: Record<string, Record<string, string>> = {
  francisco_rocha: {
    unidade_endereco: 'Rua Francisco Rocha, 198 – Batel, Curitiba/PR',
    unidade_cep: '80.420-130',
    unidade_telefone: '(41) 99999-9999',
    unidade_email: 'franciscorocha@nex.work',
  },
  nex_house: {
    unidade_endereco: 'Alameda Presidente Taunay, 130 – Batel, Curitiba/PR',
    unidade_cep: '80.420-180',
    unidade_telefone: '(41) 99999-9999',
    unidade_email: 'nexhouse@nex.work',
  },
}

const EV_FISCAL_DOMICILIO = 'Rua Francisco Rocha, 198 – Batel, Curitiba – PR, CEP 80.420-130'

function aplicarDescontoOAB(valor: string): string {
  const n = parseFloat(valor.replace('R$ ', '').replace(/\./g, '').replace(',', '.'))
  if (isNaN(n)) return valor
  return `R$ ${(n * 0.8).toFixed(2).replace('.', ',')}`
}

function formatarDataBR(iso: string): string {
  if (!iso || !iso.includes('-')) return iso
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ─────────────────────────────────────────────────────────
// Campos por tipo — Escritório Privativo (NH e FCO, mesmos campos)
// ─────────────────────────────────────────────────────────
const CAMPOS_EP: Campo[] = [
  { nome: 'nome_cliente',         label: 'Nome / Razão Social',        tipo: 'text',   obrigatorio: true },
  { nome: 'cpf_cnpj',             label: 'CPF / CNPJ',                 tipo: 'text',   obrigatorio: true },
  { nome: 'endereco_cliente',     label: 'Endereço do Contratante',    tipo: 'text',   obrigatorio: true },
  { nome: 'cidade_estado_cliente',label: 'Cidade / Estado',            tipo: 'text',   obrigatorio: true, placeholder: 'ex: Curitiba/PR' },
  { nome: 'cep_cliente',          label: 'CEP',                        tipo: 'text',   obrigatorio: true },
  { nome: 'email_cliente',        label: 'E-mail',                     tipo: 'text',   obrigatorio: true },
  { nome: 'sala',                 label: 'Sala Contratada',            tipo: 'text',   obrigatorio: true },
  { nome: 'vigencia_label',       label: 'Vigência',                   tipo: 'select', obrigatorio: true,
    opcoes: ['6 meses', '12 meses', '18 meses', '24 meses'] },
  { nome: 'data_inicio',          label: 'Data de Início',             tipo: 'date',   obrigatorio: true },
  { nome: 'data_fim',             label: 'Data de Término',            tipo: 'date',   obrigatorio: false },
  { nome: 'valor_tabela',         label: 'Valor de Tabela (R$)',       tipo: 'text',   obrigatorio: true },
  { nome: 'valor_mensal',         label: 'Valor Mensal (R$)',          tipo: 'text',   obrigatorio: true },
  { nome: 'valor_mensal_2',       label: 'Valor Mensal 2ª fase (R$)',  tipo: 'text',   obrigatorio: false,
    placeholder: 'Deixe em branco se não houver escalonamento',
    ajuda: 'Preencha somente em contratos com valor escalonado' },
  { nome: 'bonus_impressoes',     label: 'Bônus de Impressões',        tipo: 'text',   obrigatorio: false },
  { nome: 'data_assinatura',      label: 'Data de Assinatura',         tipo: 'date',   obrigatorio: true },
  { nome: 'qtd_mesa_trabalho',    label: 'Qtd. Mesas de Trabalho',     tipo: 'number', obrigatorio: false },
  { nome: 'qtd_cadeira',          label: 'Qtd. Cadeiras',              tipo: 'number', obrigatorio: false },
  { nome: 'qtd_armario',          label: 'Qtd. Armários',              tipo: 'number', obrigatorio: false },
]

// ─────────────────────────────────────────────────────────
// Campos — Nex House Atrium / Gallery (mesmos campos)
// ─────────────────────────────────────────────────────────
const CAMPOS_NEX_HOUSE: Campo[] = [
  { nome: 'nome_cliente',             label: 'Nome / Razão Social',       tipo: 'text',   obrigatorio: true },
  { nome: 'cpf_cnpj',                 label: 'CPF / CNPJ',                tipo: 'text',   obrigatorio: true },
  { nome: 'endereco_rua',             label: 'Rua',                       tipo: 'text',   obrigatorio: true },
  { nome: 'endereco_numero',          label: 'Número',                    tipo: 'text',   obrigatorio: true },
  { nome: 'endereco_complemento',     label: 'Complemento',               tipo: 'text',   obrigatorio: false },
  { nome: 'endereco_bairro',          label: 'Bairro',                    tipo: 'text',   obrigatorio: true },
  { nome: 'endereco_cidade',          label: 'Cidade',                    tipo: 'text',   obrigatorio: true },
  { nome: 'endereco_uf',              label: 'UF',                        tipo: 'text',   obrigatorio: true, placeholder: 'ex: PR' },
  { nome: 'endereco_estado',          label: 'Estado (por extenso)',      tipo: 'text',   obrigatorio: true, placeholder: 'ex: Paraná' },
  { nome: 'endereco_cep',             label: 'CEP',                       tipo: 'text',   obrigatorio: true },
  { nome: 'data_inicio',              label: 'Data de Início',            tipo: 'date',   obrigatorio: true },
  { nome: 'taxa_adesao',              label: 'Taxa de Adesão (R$)',       tipo: 'text',   obrigatorio: true },
  { nome: 'valor_mensal',             label: 'Mensalidade (R$)',          tipo: 'text',   obrigatorio: true },
  { nome: 'desconto_adesao',          label: 'Desconto na Adesão',        tipo: 'text',   obrigatorio: false, placeholder: 'texto livre' },
  { nome: 'desconto_mensalidades',    label: 'Desconto nas Mensalidades', tipo: 'text',   obrigatorio: false, placeholder: 'texto livre' },
]

// ─────────────────────────────────────────────────────────
// Campos — Termo Eventos Externo
// ─────────────────────────────────────────────────────────
const CAMPOS_TERMO_EVENTOS: Campo[] = [
  { nome: 'nome_evento',          label: 'Nome do Evento',                tipo: 'text',     obrigatorio: true },
  { nome: 'nome_responsavel',     label: 'Nome do Responsável',           tipo: 'text',     obrigatorio: true },
  { nome: 'cpf_responsavel',      label: 'CPF do Responsável',            tipo: 'text',     obrigatorio: true },
  { nome: 'nome_cliente',         label: 'Razão Social da Empresa',       tipo: 'text',     obrigatorio: true },
  { nome: 'cnpj_cliente',         label: 'CNPJ da Empresa',               tipo: 'text',     obrigatorio: true },
  { nome: 'data_evento',          label: 'Data do Evento',                tipo: 'date',     obrigatorio: true },
  { nome: 'descricao_pagamento',  label: 'Condição de Pagamento',         tipo: 'textarea', obrigatorio: true,
    placeholder: 'Ex: R$ 2.000,00 à vista, pagos em D+1 via PIX.' },
  { nome: 'valor_hora_adicional', label: 'Valor por Hora Adicional (R$)', tipo: 'text',     obrigatorio: true },
  { nome: 'data_assinatura',      label: 'Data de Assinatura',            tipo: 'date',     obrigatorio: true },
]

// ─────────────────────────────────────────────────────────
// Campos — Termo Eventos Residentes
// ─────────────────────────────────────────────────────────
const CAMPOS_TERMO_EVENTOS_RESIDENTES: Campo[] = [
  { nome: 'nome_evento',             label: 'Nome do Evento',                tipo: 'text',     obrigatorio: true },
  { nome: 'nome_responsavel',        label: 'Nome do Responsável',           tipo: 'text',     obrigatorio: true },
  { nome: 'cpf_responsavel',         label: 'CPF do Responsável',            tipo: 'text',     obrigatorio: true },
  { nome: 'nome_cliente',            label: 'Razão Social da Empresa',       tipo: 'text',     obrigatorio: true },
  { nome: 'cnpj_cliente',            label: 'CNPJ da Empresa',               tipo: 'text',     obrigatorio: true },
  { nome: 'data_evento',             label: 'Data do Evento (preâmbulo)',     tipo: 'date',     obrigatorio: true,
    ajuda: 'Usado no texto corrido. Ex: "durante o dia 17 de junho de 2026"' },
  { nome: 'data_evento_exibicao',    label: 'Data do Evento (exibição)',      tipo: 'text',     obrigatorio: true,
    placeholder: 'ex: 17/06/2026', ajuda: 'Preenchido automaticamente ao informar a data acima' },
  { nome: 'perfil_evento',           label: 'Perfil do Evento',              tipo: 'text',     obrigatorio: true, placeholder: 'ex: Palestra, Workshop' },
  { nome: 'horario_evento',          label: 'Horário',                       tipo: 'text',     obrigatorio: true, placeholder: 'ex: 18:30 às 21:30hs' },
  { nome: 'num_participantes',       label: 'Número de Participantes',       tipo: 'number',   obrigatorio: true },
  { nome: 'formato_evento',          label: 'Formato',                       tipo: 'text',     obrigatorio: true, placeholder: 'ex: Plenária, U-shape' },
  { nome: 'ambientes_adicionais',    label: 'Ambientes Adicionais',          tipo: 'text',     obrigatorio: false },
  { nome: 'obs_evento',              label: 'Observações',                   tipo: 'textarea', obrigatorio: false,
    placeholder: 'Campo livre para observações gerais do evento' },
  { nome: 'descricao_pagamento',     label: 'Condição de Pagamento',         tipo: 'textarea', obrigatorio: true,
    placeholder: 'Ex: Parcelado em 2x conforme abaixo.' },
  { nome: 'valor_parcela_1',         label: 'Valor da 1ª Parcela (R$)',      tipo: 'text',     obrigatorio: false },
  { nome: 'vencimento_parcela_1',    label: 'Vencimento da 1ª Parcela',      tipo: 'date',     obrigatorio: false },
  { nome: 'valor_parcela_2',         label: 'Valor da 2ª Parcela (R$)',      tipo: 'text',     obrigatorio: false },
  { nome: 'vencimento_parcela_2',    label: 'Vencimento da 2ª Parcela',      tipo: 'date',     obrigatorio: false },
  { nome: 'valor_hora_adicional',    label: 'Valor por Hora Adicional (R$)', tipo: 'text',     obrigatorio: true },
  { nome: 'data_assinatura',         label: 'Data de Assinatura',            tipo: 'date',     obrigatorio: true },
]

// ─────────────────────────────────────────────────────────
// Campos — Termo Diária e Reunião
// ─────────────────────────────────────────────────────────
const CAMPOS_DIARIA_REUNIAO: Campo[] = [
  { nome: 'nome_evento',          label: 'Nome / Identificador do Encontro', tipo: 'text',     obrigatorio: true },
  { nome: 'nome_responsavel',     label: 'Nome do Responsável',              tipo: 'text',     obrigatorio: true },
  { nome: 'cpf_responsavel',      label: 'CPF do Responsável',               tipo: 'text',     obrigatorio: true },
  { nome: 'rg_responsavel',       label: 'RG do Responsável',                tipo: 'text',     obrigatorio: true },
  { nome: 'data_evento',          label: 'Data do Encontro (preâmbulo)',      tipo: 'date',     obrigatorio: true },
  { nome: 'data_evento_exibicao', label: 'Data do Encontro (exibição)',       tipo: 'text',     obrigatorio: true,
    placeholder: 'ex: 17/06/2026', ajuda: 'Preenchido automaticamente' },
  { nome: 'perfil_evento',        label: 'Perfil',                           tipo: 'text',     obrigatorio: true, placeholder: 'ex: Reunião, Treinamento' },
  { nome: 'espaco',               label: 'Espaço Utilizado',                 tipo: 'text',     obrigatorio: true, placeholder: 'ex: Sala R3' },
  { nome: 'horario_evento',       label: 'Horário',                          tipo: 'text',     obrigatorio: true, placeholder: 'ex: 09:00 às 18:00hs' },
  { nome: 'num_participantes',    label: 'Número de Participantes',          tipo: 'number',   obrigatorio: true },
  { nome: 'formato_evento',       label: 'Formato',                          tipo: 'text',     obrigatorio: true, placeholder: 'ex: Layout da sala de reunião' },
  { nome: 'ambientes_adicionais', label: 'Ambientes Adicionais',             tipo: 'text',     obrigatorio: false },
  { nome: 'descricao_pagamento',  label: 'Condição de Pagamento',            tipo: 'textarea', obrigatorio: true },
  { nome: 'data_assinatura',      label: 'Data de Assinatura',               tipo: 'date',     obrigatorio: true },
]

// ─────────────────────────────────────────────────────────
// Campos — EV base (Fiscal e Comercial)
// ─────────────────────────────────────────────────────────
const CAMPOS_EV_BASE: Campo[] = [
  { nome: 'nome_cliente',         label: 'Nome / Razão Social',         tipo: 'text',     obrigatorio: true },
  { nome: 'cpf_cnpj',             label: 'CPF / CNPJ',                  tipo: 'text',     obrigatorio: true },
  { nome: 'endereco_cliente',     label: 'Endereço do Contratante',     tipo: 'text',     obrigatorio: true },
  { nome: 'cep_cliente',          label: 'CEP',                         tipo: 'text',     obrigatorio: true },
  { nome: 'email_cliente',        label: 'E-mail',                      tipo: 'text',     obrigatorio: true },
  { nome: 'modalidade_pagamento', label: 'Modalidade de Pagamento',     tipo: 'select',   obrigatorio: true,
    opcoes: ['Mensal', 'Semestral', 'Anual à vista', 'Anual parcelado'] },
  { nome: 'domicilio_fiscal',     label: 'Domicílio Fiscal Contratado', tipo: 'text',     obrigatorio: true },
  { nome: 'data_inicio',          label: 'Data de Início',              tipo: 'date',     obrigatorio: true },
  { nome: 'data_fim',             label: 'Data de Término',             tipo: 'date',     obrigatorio: true },
  { nome: 'valor_base',           label: 'Valor Base (R$)',             tipo: 'text',     obrigatorio: true,
    ajuda: 'Preenchido automaticamente pela modalidade selecionada' },
  { nome: 'valor_adesao',         label: 'Valor de Adesão',             tipo: 'text',     obrigatorio: true,
    placeholder: 'com descrição de desconto se aplicável' },
  { nome: 'renovacao_texto',      label: 'Cláusula de Renovação',       tipo: 'textarea', obrigatorio: true },
  { nome: 'data_assinatura',      label: 'Data de Assinatura',          tipo: 'date',     obrigatorio: true },
]

const CAMPOS_EV_UNIDADE: Campo[] = [
  { nome: 'unidade_selector',  label: 'Unidade',              tipo: 'select', obrigatorio: true,
    opcoes: ['francisco_rocha', 'nex_house'],
    ajuda: 'Selecione para preencher os dados da unidade automaticamente' },
  { nome: 'unidade_endereco',  label: 'Endereço da Unidade',  tipo: 'text',   obrigatorio: true },
  { nome: 'unidade_cep',       label: 'CEP da Unidade',       tipo: 'text',   obrigatorio: true },
  { nome: 'unidade_telefone',  label: 'Telefone da Unidade',  tipo: 'text',   obrigatorio: true },
  { nome: 'unidade_email',     label: 'E-mail da Unidade',    tipo: 'text',   obrigatorio: true },
]

// ─────────────────────────────────────────────────────────
// Mapa de campos por tipo de documento
// ─────────────────────────────────────────────────────────
const CAMPOS_POR_TIPO: Record<string, Campo[]> = {
  escritorio_privativo_nex_house:      CAMPOS_EP,
  escritorio_privativo_francisco_rocha: CAMPOS_EP,
  nex_house_atrium:                    CAMPOS_NEX_HOUSE,
  nex_house_gallery:                   CAMPOS_NEX_HOUSE,
  termo_eventos:                       CAMPOS_TERMO_EVENTOS,
  termo_eventos_residentes:            CAMPOS_TERMO_EVENTOS_RESIDENTES,
  termo_diaria_reuniao:                CAMPOS_DIARIA_REUNIAO,
  escritorio_virtual_fiscal:           CAMPOS_EV_BASE,
  escritorio_virtual_fiscal_oab:       CAMPOS_EV_BASE,
  escritorio_virtual_comercial:        [...CAMPOS_EV_BASE, ...CAMPOS_EV_UNIDADE],
  escritorio_virtual_comercial_oab:    [...CAMPOS_EV_BASE, ...CAMPOS_EV_UNIDADE],
}

// ─────────────────────────────────────────────────────────
// Campos dos Aditivos EV
// ─────────────────────────────────────────────────────────
const CAMPOS_ADITIVO: Record<string, Campo[]> = {
  aditivo_ev_pf_para_pj: [
    { nome: 'data_contrato_originario',  label: 'Data do Contrato Original',       tipo: 'date',     obrigatorio: true },
    { nome: 'nome_responsavel',          label: 'Nome do Contratante PF Original', tipo: 'text',     obrigatorio: true },
    { nome: 'qualificacao_coworker_pf',  label: 'Qualificação completa da PF',     tipo: 'textarea', obrigatorio: true,
      placeholder: 'Ex: brasileira, divorciada, empresária, nascida em 22/02/1980, RG 12.345.678-9, CPF 000.000.000-00, residente na Rua X, nº 00, Curitiba/PR' },
    { nome: 'data_assinatura',           label: 'Data de Assinatura do Aditivo',   tipo: 'date',     obrigatorio: true },
  ],
  aditivo_ev_pj_para_pj: [
    { nome: 'data_contrato_originario',       label: 'Data do Contrato Original',          tipo: 'date',   obrigatorio: true },
    { nome: 'endereco_coworker',              label: 'Endereço da PJ Cedente',              tipo: 'text',   obrigatorio: true },
    { nome: 'complemento_coworker',           label: 'Complemento',                         tipo: 'text',   obrigatorio: false },
    { nome: 'cep_coworker',                   label: 'CEP da PJ Cedente',                   tipo: 'text',   obrigatorio: true },
    { nome: 'nome_responsavel',               label: 'Nome do Sócio / Representante Legal', tipo: 'text',   obrigatorio: true },
    { nome: 'data_nascimento_responsavel',    label: 'Data de Nascimento do Responsável',   tipo: 'date',   obrigatorio: true },
    { nome: 'rg_responsavel',                 label: 'RG do Responsável',                   tipo: 'text',   obrigatorio: true },
    { nome: 'cpf_responsavel',                label: 'CPF do Responsável',                  tipo: 'text',   obrigatorio: true },
    { nome: 'email_cliente',                  label: 'E-mail do Responsável',               tipo: 'text',   obrigatorio: true },
    { nome: 'cel_coworker',                   label: 'Celular da PJ Cedente',               tipo: 'text',   obrigatorio: true },
    { nome: 'nome_interveniente',             label: 'Razão Social da Nova PJ',             tipo: 'text',   obrigatorio: true },
    { nome: 'fantasia_interveniente',         label: 'Nome Fantasia da Nova PJ',            tipo: 'text',   obrigatorio: false },
    { nome: 'endereco_interveniente',         label: 'Endereço da Nova PJ',                 tipo: 'text',   obrigatorio: true },
    { nome: 'complemento_interveniente',      label: 'Complemento da Nova PJ',              tipo: 'text',   obrigatorio: false },
    { nome: 'cel_interveniente',              label: 'Celular da Nova PJ',                  tipo: 'text',   obrigatorio: true },
    { nome: 'data_assinatura',                label: 'Data de Assinatura do Aditivo',       tipo: 'date',   obrigatorio: true },
  ],
}

// ─────────────────────────────────────────────────────────
// Labels do seletor de unidade EV Comercial
// ─────────────────────────────────────────────────────────
const UNIDADE_EV_LABEL: Record<string, string> = {
  francisco_rocha: 'Francisco Rocha',
  nex_house: 'Nex House',
}

// ─────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────
export default function NovoContratoPage() {
  const [tipoDoc, setTipoDoc] = useState('')
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [gerado, setGerado] = useState<{ docUrl?: string; driveUrl?: string; documentoId?: string } | null>(null)
  const [mostraAditivo, setMostraAditivo] = useState(false)
  const [tipoAditivo, setTipoAditivo] = useState('')
  const [aditivoValues, setAditivoValues] = useState<Record<string, string>>({})
  const [aditivoGerado, setAditivoGerado] = useState<{ docUrl?: string; driveUrl?: string } | null>(null)

  const campos = CAMPOS_POR_TIPO[tipoDoc] ?? []
  const camposAditivo = CAMPOS_ADITIVO[tipoAditivo] ?? []

  const isEV = tipoDoc.startsWith('escritorio_virtual')
  const isOAB = tipoDoc.includes('_oab')
  const isComercial = tipoDoc.includes('_comercial')
  const isFiscal = tipoDoc.includes('_fiscal')
  const hasDataEvento = ['termo_eventos_residentes', 'termo_diaria_reuniao'].includes(tipoDoc)

  // Reset ao trocar tipo
  useEffect(() => {
    setFormValues({})
    setGerado(null)
    setMostraAditivo(false)
    setTipoAditivo('')
    setAditivoValues({})
    setAditivoGerado(null)
  }, [tipoDoc])

  // Auto-fill: valor_base EV a partir da modalidade
  useEffect(() => {
    if (!isEV || !formValues.modalidade_pagamento) return
    const tabela = isComercial ? EV_VALORES_COMERCIAL : EV_VALORES_FISCAL
    let valor = tabela[formValues.modalidade_pagamento] ?? ''
    if (isOAB && valor) valor = aplicarDescontoOAB(valor)
    setFormValues(prev => ({ ...prev, valor_base: valor }))
  }, [formValues.modalidade_pagamento, tipoDoc])

  // Auto-fill: unidade EV Comercial
  useEffect(() => {
    if (!isComercial || !formValues.unidade_selector) return
    const unit = EV_UNIDADES_COMERCIAL[formValues.unidade_selector]
    if (unit) setFormValues(prev => ({ ...prev, ...unit }))
  }, [formValues.unidade_selector, tipoDoc])

  // Auto-fill: domicilio_fiscal para EV Fiscal (unidade sempre FCO)
  useEffect(() => {
    if (!isEV || isComercial) return
    setFormValues(prev => ({ ...prev, domicilio_fiscal: EV_FISCAL_DOMICILIO }))
  }, [tipoDoc])

  // Auto-fill: data_evento_exibicao
  useEffect(() => {
    if (!hasDataEvento || !formValues.data_evento) return
    setFormValues(prev => ({ ...prev, data_evento_exibicao: formatarDataBR(formValues.data_evento) }))
  }, [formValues.data_evento, tipoDoc])

  function setField(nome: string, valor: string) {
    setFormValues(prev => ({ ...prev, [nome]: valor }))
  }

  function setAditivoField(nome: string, valor: string) {
    setAditivoValues(prev => ({ ...prev, [nome]: valor }))
  }

  // Monta campos finais incluindo campos ocultos/auto
  function buildCamposFinais(): Record<string, string> {
    const final: Record<string, string> = { ...formValues }
    if (isEV) {
      if (isFiscal) final.opcao = 'Endereço Fiscal.'
      if (isComercial) final.opcao = 'Endereço Comercial.'
    }
    return final
  }

  async function handleGerar() {
    const obrigatoriosFaltando = campos.filter(c => c.obrigatorio && !formValues[c.nome] && c.nome !== 'unidade_selector')
    if (obrigatoriosFaltando.length > 0) {
      toast({ title: 'Campos obrigatórios', description: `Preencha: ${obrigatoriosFaltando.map(c => c.label).join(', ')}`, variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tipoDoc, campos: buildCamposFinais() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGerado(data)
      toast({ title: 'Documento gerado!', description: 'Download iniciado automaticamente.' })
      if (data.docUrl) {
        const a = document.createElement('a')
        a.href = data.docUrl
        a.download = `${tipoDoc}_${Date.now()}.docx`
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
          camposContrato: buildCamposFinais(),
          camposAditivo: aditivoValues,
          documentoOrigemId: gerado?.documentoId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAditivoGerado(data)
      toast({ title: 'Aditivo gerado!', description: 'Download iniciado.' })
      if (data.docUrl) {
        const a = document.createElement('a')
        a.href = data.docUrl
        a.download = `${tipoAditivo}_${Date.now()}.docx`
        a.click()
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  function renderCampo(campo: Campo, values: Record<string, string>, onChange: (nome: string, val: string) => void) {
    const isAutoFilled = ['valor_base', 'data_evento_exibicao', 'unidade_endereco', 'unidade_cep', 'unidade_telefone', 'unidade_email'].includes(campo.nome)

    return (
      <div key={campo.nome} className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label>
            {campo.label}
            {campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {isAutoFilled && (
            <span className="text-xs text-nex-gray-400 bg-nex-gray-100 px-1.5 py-0.5 rounded">auto</span>
          )}
        </div>
        {campo.ajuda && (
          <p className="text-xs text-nex-gray-400 flex items-center gap-1">
            <Info className="h-3 w-3" />{campo.ajuda}
          </p>
        )}

        {campo.tipo === 'select' ? (
          campo.nome === 'unidade_selector' ? (
            <Select value={values[campo.nome] ?? ''} onValueChange={v => onChange(campo.nome, v)}>
              <SelectTrigger><SelectValue placeholder="Selecione a unidade..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(UNIDADE_EV_LABEL).map(([val, lbl]) => (
                  <SelectItem key={val} value={val}>{lbl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={values[campo.nome] ?? ''} onValueChange={v => onChange(campo.nome, v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {campo.opcoes?.map(op => (
                  <SelectItem key={op} value={op}>{op}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        ) : campo.tipo === 'textarea' ? (
          <Textarea
            value={values[campo.nome] ?? ''}
            onChange={e => onChange(campo.nome, e.target.value)}
            placeholder={campo.placeholder}
            className="min-h-[100px]"
          />
        ) : (
          <Input
            type={campo.tipo}
            value={values[campo.nome] ?? ''}
            onChange={e => onChange(campo.nome, e.target.value)}
            placeholder={campo.placeholder}
            readOnly={isAutoFilled && !!values[campo.nome]}
            className={isAutoFilled && values[campo.nome] ? 'bg-nex-gray-50 text-nex-gray-600' : ''}
          />
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Novo Contrato" description="Gere contratos e termos padronizados com preenchimento automático." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipo de Documento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Seletor de tipo */}
          <div className="space-y-2">
            <Label>Selecione o tipo *</Label>
            <Select value={tipoDoc} onValueChange={setTipoDoc}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o tipo de documento..." />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-xs font-semibold text-nex-gray-400 uppercase tracking-wide">Escritório Privativo</div>
                {TIPOS_CONTRATO.filter(t => t.value.startsWith('escritorio_privativo')).map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
                <div className="px-2 py-1 text-xs font-semibold text-nex-gray-400 uppercase tracking-wide mt-1">Nex House</div>
                {TIPOS_CONTRATO.filter(t => t.value.startsWith('nex_house')).map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
                <div className="px-2 py-1 text-xs font-semibold text-nex-gray-400 uppercase tracking-wide mt-1">Termos de Compromisso</div>
                {TIPOS_CONTRATO.filter(t => t.value.startsWith('termo')).map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
                <div className="px-2 py-1 text-xs font-semibold text-nex-gray-400 uppercase tracking-wide mt-1">Escritório Virtual</div>
                {TIPOS_CONTRATO.filter(t => t.value.startsWith('escritorio_virtual')).map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Formulário dinâmico */}
          {tipoDoc && campos.length > 0 && (
            <div className="space-y-4 pt-2 border-t">
              <p className="text-sm font-semibold text-nex-gray-600 uppercase tracking-wide">Dados do documento</p>

              {/* OAB info banner */}
              {isOAB && (
                <div className="flex items-start gap-2 p-3 bg-nex-yellow/10 border border-nex-yellow rounded-md">
                  <Info className="h-4 w-4 text-nex-gray-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-nex-gray-600">
                    Contrato OAB — desconto de 20% aplicado automaticamente sobre o valor de tabela vigente.
                  </p>
                </div>
              )}

              {campos.map(campo => renderCampo(campo, formValues, setField))}

              <Button variant="primary" className="w-full mt-4" onClick={handleGerar} disabled={loading}>
                <FileText className="h-4 w-4" />
                {loading ? 'Gerando...' : 'Gerar Documento'}
              </Button>
            </div>
          )}

          {/* Resultado */}
          {gerado && (
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <p className="text-sm text-green-700 font-medium">Documento gerado com sucesso!</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {gerado.docUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={gerado.docUrl} download>
                      <Download className="h-4 w-4" />Baixar .docx
                    </a>
                  </Button>
                )}
                {gerado.driveUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={gerado.driveUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />Ver no Drive
                    </a>
                  </Button>
                )}
              </div>

              {/* Botão aditivo só para EV */}
              {isEV && !mostraAditivo && (
                <Button variant="secondary" onClick={() => setMostraAditivo(true)} className="w-full">
                  <Plus className="h-4 w-4" />Gerar Aditivo
                </Button>
              )}
            </div>
          )}

          {/* Seção de aditivo */}
          {mostraAditivo && (
            <div className="pt-4 border-t space-y-4">
              <p className="text-sm font-semibold text-nex-gray-600 uppercase tracking-wide">Aditivo Contratual</p>
              <div className="space-y-2">
                <Label>Tipo de Aditivo *</Label>
                <Select value={tipoAditivo} onValueChange={v => { setTipoAditivo(v); setAditivoValues({}) }}>
                  <SelectTrigger><SelectValue placeholder="Escolha o tipo de aditivo..." /></SelectTrigger>
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
                    Os dados do contrato original ({formValues.nome_cliente}) serão incorporados automaticamente.
                  </div>
                  {camposAditivo.map(campo => renderCampo(campo, aditivoValues, setAditivoField))}
                  <Button variant="primary" className="w-full" onClick={handleGerarAditivo} disabled={loading}>
                    <FileText className="h-4 w-4" />
                    {loading ? 'Gerando...' : 'Gerar Aditivo'}
                  </Button>
                </>
              )}

              {aditivoGerado && (
                <div className="flex gap-2 pt-2 flex-wrap">
                  {aditivoGerado.docUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={aditivoGerado.docUrl} download>
                        <Download className="h-4 w-4" />Baixar Aditivo
                      </a>
                    </Button>
                  )}
                  {aditivoGerado.driveUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={aditivoGerado.driveUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />Ver no Drive
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
