'use client'
import { useState, useEffect, useRef } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { TIPOS_ADITIVO } from '@/types'
import { FileText, Download, Plus, ExternalLink, Info, Check, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

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
// Seletor visual de tipo de documento
// ─────────────────────────────────────────────────────────
const CATEGORIAS_CONTRATO = [
  {
    id: 'escritorio_privativo',
    label: 'Escritório Privativo',
    tipos: [
      { value: 'escritorio_privativo_nex_house',       label: 'Nex House' },
      { value: 'escritorio_privativo_francisco_rocha', label: 'Francisco Rocha' },
    ],
  },
  {
    id: 'nex_house',
    label: 'Nex House',
    tipos: [
      { value: 'nex_house_atrium',  label: 'Atrium' },
      { value: 'nex_house_gallery', label: 'Gallery' },
      { value: 'nex_house_atrium_anual',  label: 'Assinatura Atrium Anual' },
      { value: 'nex_house_gallery_anual', label: 'Assinatura Gallery Anual' },
    ],
  },
  {
    id: 'termos',
    label: 'Termos',
    tipos: [
      { value: 'termo_eventos',            label: 'Eventos — Externo' },
      { value: 'termo_eventos_residentes', label: 'Eventos — Residentes' },
      { value: 'termo_diaria_reuniao',     label: 'Diária e Reunião' },
    ],
  },
  {
    id: 'escritorio_virtual',
    label: 'Escritório Virtual',
    tipos: [
      { value: 'escritorio_virtual_fiscal',         label: 'Endereço Fiscal' },
      { value: 'escritorio_virtual_fiscal_oab',     label: 'Endereço Fiscal OAB' },
      { value: 'escritorio_virtual_comercial',      label: 'Endereço Comercial' },
      { value: 'escritorio_virtual_comercial_oab',  label: 'Endereço Comercial OAB' },
    ],
  },
  {
    id: 'aditivos_ev',
    label: 'Aditivos EV',
    tipos: [
      { value: 'aditivo_ev_pf_para_pj',         label: 'Troca de Polo PF → PJ' },
      { value: 'aditivo_ev_pj_para_pj',         label: 'Troca de Polo PJ → PJ' },
      { value: 'aditivo_ev_alteracao_endereco', label: 'Troca de Endereço' },
    ],
  },
]

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
const EV_MESES: Record<string, number> = {
  'Mensal': 1, 'Semestral': 6, 'Anual à vista': 12, 'Anual parcelado': 12,
}

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

function adicionarMeses(isoDate: string, meses: number): string {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  d.setMonth(d.getMonth() + meses)
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

// ─────────────────────────────────────────────────────────
// Definição de campos
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
  { nome: 'data_fim',             label: 'Data de Término',            tipo: 'date',   obrigatorio: false,
    ajuda: 'Calculada automaticamente pela vigência + data de início' },
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
// Campos — Nex House Assinatura Anual (Atrium / Gallery)
// Planos com preço e taxa fixos no modelo; só dados do membro + início.
// ─────────────────────────────────────────────────────────
const CAMPOS_NEX_HOUSE_ANUAL: Campo[] = [
  { nome: 'nome_cliente',         label: 'Nome / Razão Social',   tipo: 'text', obrigatorio: true },
  { nome: 'cpf_cnpj',             label: 'CPF / CNPJ',            tipo: 'text', obrigatorio: true },
  { nome: 'endereco_rua',         label: 'Rua',                   tipo: 'text', obrigatorio: true },
  { nome: 'endereco_numero',      label: 'Número',                tipo: 'text', obrigatorio: true },
  { nome: 'endereco_complemento', label: 'Complemento',           tipo: 'text', obrigatorio: false },
  { nome: 'endereco_bairro',      label: 'Bairro',                tipo: 'text', obrigatorio: true },
  { nome: 'endereco_cidade',      label: 'Cidade',                tipo: 'text', obrigatorio: true },
  { nome: 'endereco_uf',          label: 'UF',                    tipo: 'text', obrigatorio: true, placeholder: 'ex: PR' },
  { nome: 'endereco_estado',      label: 'Estado (por extenso)',  tipo: 'text', obrigatorio: true, placeholder: 'ex: Paraná' },
  { nome: 'endereco_cep',         label: 'CEP',                   tipo: 'text', obrigatorio: true },
  { nome: 'data_inicio',          label: 'Data de Início',        tipo: 'date', obrigatorio: true },
]

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

const CAMPOS_TERMO_EVENTOS_RESIDENTES: Campo[] = [
  { nome: 'nome_evento',             label: 'Nome do Evento',                tipo: 'text',     obrigatorio: true },
  { nome: 'nome_responsavel',        label: 'Nome do Responsável',           tipo: 'text',     obrigatorio: true },
  { nome: 'cpf_responsavel',         label: 'CPF do Responsável',            tipo: 'text',     obrigatorio: true },
  { nome: 'nome_cliente',            label: 'Razão Social da Empresa',       tipo: 'text',     obrigatorio: true },
  { nome: 'cnpj_cliente',            label: 'CNPJ da Empresa',               tipo: 'text',     obrigatorio: true },
  { nome: 'data_evento',             label: 'Data do Evento (preâmbulo)',     tipo: 'date',     obrigatorio: true,
    ajuda: 'Usado no texto corrido. Ex: "durante o dia 17 de junho de 2026"' },
  { nome: 'data_evento_exibicao',    label: 'Data do Evento (exibição)',      tipo: 'text',     obrigatorio: true,
    placeholder: 'ex: 17/06/2026', ajuda: 'Preenchida automaticamente ao informar a data acima' },
  { nome: 'perfil_evento',           label: 'Perfil do Evento',              tipo: 'text',     obrigatorio: true, placeholder: 'ex: Palestra, Workshop' },
  { nome: 'horario_evento',          label: 'Horário',                       tipo: 'text',     obrigatorio: true, placeholder: 'ex: 18:30 às 21:30hs' },
  { nome: 'num_participantes',       label: 'Número de Participantes',       tipo: 'number',   obrigatorio: true },
  { nome: 'formato_evento',          label: 'Formato',                       tipo: 'text',     obrigatorio: true, placeholder: 'ex: Plenária, U-shape' },
  { nome: 'ambientes_adicionais',    label: 'Ambientes Adicionais',          tipo: 'text',     obrigatorio: false },
  { nome: 'obs_evento',              label: 'Observações',                   tipo: 'textarea', obrigatorio: false },
  { nome: 'descricao_pagamento',     label: 'Condição de Pagamento',         tipo: 'textarea', obrigatorio: true,
    placeholder: 'Ex: Parcelado em 2x conforme abaixo.' },
  { nome: 'valor_parcela_1',         label: 'Valor da 1ª Parcela (R$)',      tipo: 'text',     obrigatorio: false },
  { nome: 'vencimento_parcela_1',    label: 'Vencimento da 1ª Parcela',      tipo: 'date',     obrigatorio: false },
  { nome: 'valor_parcela_2',         label: 'Valor da 2ª Parcela (R$)',      tipo: 'text',     obrigatorio: false },
  { nome: 'vencimento_parcela_2',    label: 'Vencimento da 2ª Parcela',      tipo: 'date',     obrigatorio: false },
  { nome: 'valor_hora_adicional',    label: 'Valor por Hora Adicional (R$)', tipo: 'text',     obrigatorio: true },
  { nome: 'data_assinatura',         label: 'Data de Assinatura',            tipo: 'date',     obrigatorio: true },
]

const CAMPOS_DIARIA_REUNIAO: Campo[] = [
  { nome: 'nome_evento',          label: 'Nome / Identificador do Encontro', tipo: 'text',     obrigatorio: true },
  { nome: 'nome_responsavel',     label: 'Nome do Responsável',              tipo: 'text',     obrigatorio: true },
  { nome: 'cpf_responsavel',      label: 'CPF do Responsável',               tipo: 'text',     obrigatorio: true },
  { nome: 'rg_responsavel',       label: 'RG do Responsável',                tipo: 'text',     obrigatorio: true },
  { nome: 'data_evento',          label: 'Data do Encontro (preâmbulo)',      tipo: 'date',     obrigatorio: true },
  { nome: 'data_evento_exibicao', label: 'Data do Encontro (exibição)',       tipo: 'text',     obrigatorio: true,
    placeholder: 'ex: 17/06/2026', ajuda: 'Preenchida automaticamente' },
  { nome: 'perfil_evento',        label: 'Perfil',                           tipo: 'text',     obrigatorio: true, placeholder: 'ex: Reunião, Treinamento' },
  { nome: 'espaco',               label: 'Espaço Utilizado',                 tipo: 'text',     obrigatorio: true, placeholder: 'ex: Sala R3' },
  { nome: 'horario_evento',       label: 'Horário',                          tipo: 'text',     obrigatorio: true, placeholder: 'ex: 09:00 às 18:00hs' },
  { nome: 'num_participantes',    label: 'Número de Participantes',          tipo: 'number',   obrigatorio: true },
  { nome: 'formato_evento',       label: 'Formato',                          tipo: 'text',     obrigatorio: true, placeholder: 'ex: Layout da sala de reunião' },
  { nome: 'ambientes_adicionais', label: 'Ambientes Adicionais',             tipo: 'text',     obrigatorio: false },
  { nome: 'descricao_pagamento',  label: 'Condição de Pagamento',            tipo: 'textarea', obrigatorio: true },
  { nome: 'data_assinatura',      label: 'Data de Assinatura',               tipo: 'date',     obrigatorio: true },
]

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
  { nome: 'data_fim',             label: 'Data de Término',             tipo: 'date',     obrigatorio: true,
    ajuda: 'Calculada automaticamente pela modalidade + data de início' },
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
// Campos — Aditivos EV (base, sem nome_cliente/cpf_cnpj)
// Usados no fluxo linked (CAMPOS_ADITIVO) e reutilizados no standalone (CAMPOS_POR_TIPO).
// ─────────────────────────────────────────────────────────
const _ADITIVO_PF_PARA_PJ: Campo[] = [
  { nome: 'data_contrato_originario',  label: 'Data do Contrato Original',       tipo: 'date',     obrigatorio: true },
  { nome: 'nome_responsavel',          label: 'Nome do Contratante PF Original', tipo: 'text',     obrigatorio: true },
  { nome: 'qualificacao_coworker_pf',  label: 'Qualificação completa da PF',     tipo: 'textarea', obrigatorio: true,
    placeholder: 'Ex: brasileira, divorciada, empresária, nascida em 22/02/1980, RG 12.345.678-9, CPF 000.000.000-00, residente na Rua X, nº 00, Curitiba/PR' },
  { nome: 'data_assinatura',           label: 'Data de Assinatura do Aditivo',   tipo: 'date',     obrigatorio: true },
]

const _ADITIVO_PJ_PARA_PJ: Campo[] = [
  { nome: 'data_contrato_originario',    label: 'Data do Contrato Original',           tipo: 'date',   obrigatorio: true },
  { nome: 'endereco_coworker',           label: 'Endereço da PJ Cedente',              tipo: 'text',   obrigatorio: true },
  { nome: 'complemento_coworker',        label: 'Complemento',                         tipo: 'text',   obrigatorio: false },
  { nome: 'cep_coworker',                label: 'CEP da PJ Cedente',                   tipo: 'text',   obrigatorio: true },
  { nome: 'nome_responsavel',            label: 'Nome do Sócio / Representante Legal', tipo: 'text',   obrigatorio: true },
  { nome: 'data_nascimento_responsavel', label: 'Data de Nascimento do Responsável',   tipo: 'date',   obrigatorio: true },
  { nome: 'rg_responsavel',              label: 'RG do Responsável',                   tipo: 'text',   obrigatorio: true },
  { nome: 'cpf_responsavel',             label: 'CPF do Responsável',                  tipo: 'text',   obrigatorio: true },
  { nome: 'email_cliente',               label: 'E-mail do Responsável',               tipo: 'text',   obrigatorio: true },
  { nome: 'cel_coworker',                label: 'Celular da PJ Cedente',               tipo: 'text',   obrigatorio: true },
  { nome: 'nome_interveniente',          label: 'Razão Social da Nova PJ',             tipo: 'text',   obrigatorio: true },
  { nome: 'fantasia_interveniente',      label: 'Nome Fantasia da Nova PJ',            tipo: 'text',   obrigatorio: false },
  { nome: 'endereco_interveniente',      label: 'Endereço da Nova PJ',                tipo: 'text',   obrigatorio: true },
  { nome: 'complemento_interveniente',   label: 'Complemento da Nova PJ',             tipo: 'text',   obrigatorio: false },
  { nome: 'cel_interveniente',           label: 'Celular da Nova PJ',                 tipo: 'text',   obrigatorio: true },
  { nome: 'data_assinatura',             label: 'Data de Assinatura do Aditivo',       tipo: 'date',   obrigatorio: true },
]

const _ADITIVO_ALTERACAO_ENDERECO: Campo[] = [
  { nome: 'endereco_antigo',           label: 'Endereço Antigo (completo)',            tipo: 'textarea', obrigatorio: true,
    placeholder: 'Ex: Rua Emiliano Perneta, 725, Loja 01, bairro Centro, Curitiba-PR, CEP 80.420-080' },
  { nome: 'data_contrato_originario',  label: 'Data do Contrato Original',            tipo: 'date',   obrigatorio: true },
  { nome: 'modalidade_ev',             label: 'Modalidade do EV',                     tipo: 'select', obrigatorio: true,
    opcoes: ['Endereço Fiscal', 'Endereço Fiscal OAB', 'Endereço Comercial', 'Endereço Comercial OAB'] },
  { nome: 'endereco_novo_rua',         label: 'Novo Endereço — Rua',                  tipo: 'text',   obrigatorio: true,
    placeholder: 'Ex: Rua Francisco Rocha, 198 – Batel' },
  { nome: 'endereco_novo_cep',         label: 'Novo Endereço — CEP',                  tipo: 'text',   obrigatorio: true,
    placeholder: '80.420-130' },
  { nome: 'data_assinatura',           label: 'Data de Assinatura do Aditivo',        tipo: 'date',   obrigatorio: true },
]

const CAMPOS_POR_TIPO: Record<string, Campo[]> = {
  escritorio_privativo_nex_house:       CAMPOS_EP,
  escritorio_privativo_francisco_rocha: CAMPOS_EP,
  nex_house_atrium:                     CAMPOS_NEX_HOUSE,
  nex_house_gallery:                    CAMPOS_NEX_HOUSE,
  nex_house_atrium_anual:               CAMPOS_NEX_HOUSE_ANUAL,
  nex_house_gallery_anual:              CAMPOS_NEX_HOUSE_ANUAL,
  termo_eventos:                        CAMPOS_TERMO_EVENTOS,
  termo_eventos_residentes:             CAMPOS_TERMO_EVENTOS_RESIDENTES,
  termo_diaria_reuniao:                 CAMPOS_DIARIA_REUNIAO,
  escritorio_virtual_fiscal:            CAMPOS_EV_BASE,
  escritorio_virtual_fiscal_oab:        CAMPOS_EV_BASE,
  escritorio_virtual_comercial:         [...CAMPOS_EV_BASE, ...CAMPOS_EV_UNIDADE],
  escritorio_virtual_comercial_oab:     [...CAMPOS_EV_BASE, ...CAMPOS_EV_UNIDADE],
  aditivo_ev_pf_para_pj: [
    { nome: 'nome_cliente', label: 'Nome / Razão Social',  tipo: 'text', obrigatorio: true },
    { nome: 'cpf_cnpj',     label: 'CPF / CNPJ',           tipo: 'text', obrigatorio: true },
    ..._ADITIVO_PF_PARA_PJ,
  ],
  aditivo_ev_pj_para_pj: [
    { nome: 'nome_cliente', label: 'Razão Social da Empresa Cedente', tipo: 'text', obrigatorio: true },
    { nome: 'cpf_cnpj',     label: 'CNPJ da Empresa Cedente',         tipo: 'text', obrigatorio: true },
    ..._ADITIVO_PJ_PARA_PJ,
  ],
  aditivo_ev_alteracao_endereco: [
    { nome: 'nome_cliente', label: 'Nome / Razão Social',  tipo: 'text', obrigatorio: true },
    { nome: 'cpf_cnpj',     label: 'CPF / CNPJ',           tipo: 'text', obrigatorio: true },
    ..._ADITIVO_ALTERACAO_ENDERECO,
  ],
}

const CAMPOS_ADITIVO: Record<string, Campo[]> = {
  aditivo_ev_pf_para_pj:         _ADITIVO_PF_PARA_PJ,
  aditivo_ev_pj_para_pj:         _ADITIVO_PJ_PARA_PJ,
  aditivo_ev_alteracao_endereco: _ADITIVO_ALTERACAO_ENDERECO,
}

const UNIDADE_EV_LABEL: Record<string, string> = {
  francisco_rocha: 'Francisco Rocha',
  nex_house: 'Nex House',
}

const CAMPOS_AUTO = ['valor_base', 'data_fim', 'data_evento_exibicao', 'domicilio_fiscal',
  'unidade_endereco', 'unidade_cep', 'unidade_telefone', 'unidade_email']

// ─────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────
export default function NovoContratoPage() {
  const [categoriaAtiva, setCategoriaAtiva] = useState('')
  const [tipoDoc, setTipoDoc] = useState('')
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [gerado, setGerado] = useState<{ docUrl?: string; driveUrl?: string; documentoId?: string } | null>(null)
  const [tentouGerar, setTentouGerar] = useState(false)
  const [mostraAditivo, setMostraAditivo] = useState(false)
  const [tipoAditivo, setTipoAditivo] = useState('')
  const [aditivoValues, setAditivoValues] = useState<Record<string, string>>({})
  const [aditivoGerado, setAditivoGerado] = useState<{ docUrl?: string; driveUrl?: string } | null>(null)

  // Templates dinâmicos importados via IA
  const [categoriasExtra, setCategoriasExtra] = useState<typeof CATEGORIAS_CONTRATO>([])
  const [camposExtra, setCamposExtra] = useState<Record<string, Campo[]>>({})
  const carregouDinamicos = useRef(false)

  useEffect(() => {
    if (carregouDinamicos.current) return
    carregouDinamicos.current = true
    fetch('/api/templates/dinamicos')
      .then(r => r.json())
      .then(data => {
        const templates: Array<{ tipo: string; nome: string; campos_json: Campo[] }> = data.templates ?? []
        if (templates.length === 0) return
        setCategoriasExtra([{
          id: 'personalizados',
          label: 'Personalizados',
          tipos: templates.map(t => ({ value: t.tipo, label: t.nome })),
        }])
        const extra: Record<string, Campo[]> = {}
        for (const t of templates) extra[t.tipo] = t.campos_json ?? []
        setCamposExtra(extra)
      })
      .catch(() => { /* silencioso — sem personalizados carregados */ })
  }, [])

  const todasCategorias = [...CATEGORIAS_CONTRATO, ...categoriasExtra]

  const campos = CAMPOS_POR_TIPO[tipoDoc] ?? camposExtra[tipoDoc] ?? []
  const camposAditivo = CAMPOS_ADITIVO[tipoAditivo] ?? []

  const isEV = tipoDoc.startsWith('escritorio_virtual')
  const isOAB = tipoDoc.includes('_oab')
  const isComercial = tipoDoc.includes('_comercial')
  const isFiscal = tipoDoc.includes('_fiscal')
  const isEP = tipoDoc.startsWith('escritorio_privativo')
  const hasDataEvento = ['termo_eventos_residentes', 'termo_diaria_reuniao'].includes(tipoDoc)

  // Métricas de progresso
  const camposObrigatorios = campos.filter(c => c.obrigatorio && c.nome !== 'unidade_selector')
  const preenchidos = camposObrigatorios.filter(c => !!formValues[c.nome])
  const progresso = camposObrigatorios.length > 0
    ? Math.round((preenchidos.length / camposObrigatorios.length) * 100)
    : 0

  // Nome do tipo selecionado
  const tipoLabel = todasCategorias
    .flatMap(c => c.tipos)
    .find(t => t.value === tipoDoc)?.label ?? ''

  // Reset ao trocar tipo
  useEffect(() => {
    setFormValues({})
    setTentouGerar(false)
    setGerado(null)
    setMostraAditivo(false)
    setTipoAditivo('')
    setAditivoValues({})
    setAditivoGerado(null)
  }, [tipoDoc])

  // Auto-fill: valor_base EV
  useEffect(() => {
    if (!isEV || !formValues.modalidade_pagamento) return
    const tabela = isComercial ? EV_VALORES_COMERCIAL : EV_VALORES_FISCAL
    let valor = tabela[formValues.modalidade_pagamento] ?? ''
    if (isOAB && valor) valor = aplicarDescontoOAB(valor)
    setFormValues(prev => ({ ...prev, valor_base: valor }))
  }, [formValues.modalidade_pagamento, tipoDoc])

  // Auto-fill: data_fim EV (modalidade + data_inicio)
  useEffect(() => {
    if (!isEV || !formValues.modalidade_pagamento || !formValues.data_inicio) return
    const meses = EV_MESES[formValues.modalidade_pagamento]
    if (!meses) return
    setFormValues(prev => ({ ...prev, data_fim: adicionarMeses(formValues.data_inicio, meses) }))
  }, [formValues.modalidade_pagamento, formValues.data_inicio, tipoDoc])

  // Auto-fill: data_fim EP (vigencia_label + data_inicio)
  useEffect(() => {
    if (!isEP || !formValues.vigencia_label || !formValues.data_inicio) return
    const [n] = formValues.vigencia_label.split(' ')
    const meses = parseInt(n)
    if (isNaN(meses)) return
    setFormValues(prev => ({ ...prev, data_fim: adicionarMeses(formValues.data_inicio, meses) }))
  }, [formValues.vigencia_label, formValues.data_inicio, tipoDoc])

  // Auto-fill: unidade EV Comercial
  useEffect(() => {
    if (!isComercial || !formValues.unidade_selector) return
    const unit = EV_UNIDADES_COMERCIAL[formValues.unidade_selector]
    if (unit) setFormValues(prev => ({ ...prev, ...unit }))
  }, [formValues.unidade_selector, tipoDoc])

  // Auto-fill: domicilio_fiscal EV Fiscal
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

  function baixarDocxBlob(docUrl: string, filename: string) {
    const base64 = docUrl.includes(',') ? docUrl.split(',')[1] : docUrl
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function buildCamposFinais(): Record<string, string> {
    const final: Record<string, string> = { ...formValues }
    if (isEV) {
      if (isFiscal) final.opcao = 'Endereço Fiscal.'
      if (isComercial) final.opcao = 'Endereço Comercial.'
    }
    return final
  }

  async function handleGerar() {
    const faltando = campos.filter(c => c.obrigatorio && !formValues[c.nome] && c.nome !== 'unidade_selector')
    if (faltando.length > 0) {
      setTentouGerar(true)
      toast({ title: `Faltam ${faltando.length} campos obrigatórios`, description: faltando.slice(0, 4).map(c => c.label).join(', ') + (faltando.length > 4 ? '…' : ''), variant: 'destructive' })
      document.getElementById(`campo-${faltando[0].nome}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
        baixarDocxBlob(data.docUrl, `${tipoDoc}_${Date.now()}.docx`)
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally { setLoading(false) }
  }

  async function handleGerarAditivo() {
    const faltando = camposAditivo.filter(c => c.obrigatorio && !aditivoValues[c.nome])
    if (faltando.length > 0) {
      toast({ title: 'Campos obrigatórios', description: `Preencha: ${faltando.map(c => c.label).join(', ')}`, variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/contratos/aditivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tipoAditivo, camposContrato: buildCamposFinais(), camposAditivo: aditivoValues, documentoOrigemId: gerado?.documentoId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAditivoGerado(data)
      toast({ title: 'Aditivo gerado!', description: 'Download iniciado.' })
      if (data.docUrl) {
        baixarDocxBlob(data.docUrl, `${tipoAditivo}_${Date.now()}.docx`)
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally { setLoading(false) }
  }

  function renderCampo(campo: Campo, values: Record<string, string>, onChange: (n: string, v: string) => void, mostrarErros = false) {
    const isAuto = CAMPOS_AUTO.includes(campo.nome)
    const isFilled = !!values[campo.nome]
    const temErro = mostrarErros && campo.obrigatorio && !isFilled && campo.nome !== 'unidade_selector'
    return (
      <div key={campo.nome} id={`campo-${campo.nome}`} className="space-y-1.5">
        <div className="flex items-center gap-2">
          <label className={cn(
            'text-[11px] font-heading font-semibold uppercase tracking-widest',
            temErro ? 'text-red-500' : 'text-nex-gray-400'
          )}>
            {campo.label}
            {campo.obrigatorio && <span className="text-red-400 ml-1">*</span>}
          </label>
          {isAuto && (
            <span className="text-[10px] font-heading font-medium uppercase tracking-widest bg-nex-gray-100 text-nex-gray-400 px-1.5 py-0.5 rounded">auto</span>
          )}
        </div>
        {campo.ajuda && (
          <p className="text-[11px] text-nex-gray-400 flex items-center gap-1">
            <Info className="h-3 w-3 flex-shrink-0" />{campo.ajuda}
          </p>
        )}
        {campo.tipo === 'select' ? (
          campo.nome === 'unidade_selector' ? (
            <Select value={values[campo.nome] ?? ''} onValueChange={v => onChange(campo.nome, v)}>
              <SelectTrigger className={temErro ? 'border-red-300' : ''}><SelectValue placeholder="Selecione a unidade..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(UNIDADE_EV_LABEL).map(([val, lbl]) => (
                  <SelectItem key={val} value={val}>{lbl}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select value={values[campo.nome] ?? ''} onValueChange={v => onChange(campo.nome, v)}>
              <SelectTrigger className={temErro ? 'border-red-300' : ''}><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {campo.opcoes?.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
              </SelectContent>
            </Select>
          )
        ) : campo.tipo === 'textarea' ? (
          <Textarea
            value={values[campo.nome] ?? ''}
            onChange={e => onChange(campo.nome, e.target.value)}
            placeholder={campo.placeholder}
            className={cn('min-h-[80px] text-sm font-bold', temErro ? 'border-red-300' : '')}
          />
        ) : (
          <Input
            type={campo.tipo}
            value={values[campo.nome] ?? ''}
            onChange={e => onChange(campo.nome, e.target.value)}
            placeholder={campo.placeholder}
            readOnly={isAuto && isFilled}
            className={cn(
              'text-sm font-bold',
              isAuto && isFilled ? 'bg-nex-gray-50 text-nex-gray-500' : '',
              temErro ? 'border-red-300' : ''
            )}
          />
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Novo Contrato" description="Gere contratos e termos padronizados com preenchimento automático." />

      {/* ── Seletor visual de categoria ── */}
      <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden mb-5">
        <div className="flex border-b border-nex-gray-100 overflow-x-auto">
          {todasCategorias.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setCategoriaAtiva(cat.id); setTipoDoc('') }}
              className={cn(
                'px-5 py-3 text-xs font-heading font-semibold uppercase tracking-widest whitespace-nowrap transition-colors flex-shrink-0',
                categoriaAtiva === cat.id
                  ? 'text-nex-black border-b-2 border-nex-black -mb-px bg-white'
                  : 'text-nex-gray-400 hover:text-nex-gray-700 hover:bg-nex-gray-50'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {categoriaAtiva && (
          <div className="flex flex-wrap gap-2 p-3">
            {todasCategorias.find(c => c.id === categoriaAtiva)?.tipos.map(t => (
              <button
                key={t.value}
                onClick={() => setTipoDoc(t.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-heading font-medium transition-colors',
                  tipoDoc === t.value
                    ? 'bg-nex-black text-white'
                    : 'bg-nex-gray-50 text-nex-gray-600 hover:bg-nex-gray-100 hover:text-nex-black border border-nex-gray-200'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {!categoriaAtiva && (
          <p className="px-4 py-3 text-xs font-bold text-nex-gray-300">Selecione uma categoria acima para começar</p>
        )}
      </div>

      {tipoDoc && campos.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">

          {/* ── Formulário ── */}
          <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
            {isOAB && (
              <div className="flex items-start gap-2 px-5 py-3 bg-amber-50 border-b border-amber-200">
                <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs font-bold text-amber-800">
                  Contrato OAB — desconto de 20% aplicado automaticamente sobre o valor de tabela vigente.
                </p>
              </div>
            )}
            <div className="p-5 space-y-4">
              {campos.map(campo => renderCampo(campo, formValues, setField, tentouGerar))}
            </div>
            <div className="px-5 py-4 border-t border-nex-gray-100">
              <Button className="w-full gap-2" onClick={handleGerar} disabled={loading}>
                <FileText className="h-4 w-4" />
                {loading ? 'Gerando...' : 'Gerar Documento'}
              </Button>
            </div>
          </div>

          {/* ── Painel lateral: progresso + checklist ── */}
          <div className="sticky top-6 space-y-4">

            {/* Progresso */}
            <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-nex-gray-100">
                <p className="text-xs font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Progresso</p>
              </div>
              <div className="p-4">
                <div className="flex items-end justify-between mb-2">
                  <span className="text-2xl font-heading font-bold text-nex-black">{progresso}%</span>
                  <span className="text-xs font-bold text-nex-gray-400">
                    {preenchidos.length}/{camposObrigatorios.length} obrigatórios
                  </span>
                </div>
                <div className="h-1.5 bg-nex-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      progresso === 100 ? 'bg-green-500' : 'bg-nex-black'
                    )}
                    style={{ width: `${progresso}%` }}
                  />
                </div>
                {progresso === 100 && (
                  <p className="text-xs font-semibold text-green-600 mt-2 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Pronto para gerar!
                  </p>
                )}
              </div>
            </div>

            {/* Checklist */}
            <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-nex-gray-100">
                <p className="text-xs font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Campos obrigatórios</p>
              </div>
              <div className="p-3 space-y-1.5 max-h-[50vh] overflow-y-auto">
                {camposObrigatorios.map(campo => {
                  const ok = !!formValues[campo.nome]
                  return (
                    <div key={campo.nome} className="flex items-center gap-2">
                      {ok
                        ? <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        : <Circle className="w-3.5 h-3.5 text-nex-gray-300 flex-shrink-0" />
                      }
                      <span className={cn(
                        'text-xs font-bold truncate',
                        ok ? 'text-nex-gray-400 line-through' : 'text-nex-gray-700'
                      )}>
                        {campo.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Resultado */}
            {gerado && (
              <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-green-100 bg-green-50 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <p className="text-xs font-heading font-semibold uppercase tracking-widest text-green-700">Gerado com sucesso</p>
                </div>
                <div className="p-3 space-y-2">
                  {gerado.docUrl && (
                    <button onClick={() => baixarDocxBlob(gerado.docUrl!, `${tipoDoc}_${Date.now()}.docx`)} className="flex items-center gap-2 text-xs font-bold text-nex-black hover:text-nex-gray-600 transition-colors">
                      <Download className="w-3.5 h-3.5" /> Baixar .docx
                    </button>
                  )}
                  {gerado.driveUrl && (
                    <a href={gerado.driveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold text-nex-black hover:text-nex-gray-600 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> Ver no Drive
                    </a>
                  )}
                  {isEV && !mostraAditivo && (
                    <button
                      onClick={() => setMostraAditivo(true)}
                      className="flex items-center gap-2 text-xs font-bold text-nex-gray-500 hover:text-nex-black transition-colors mt-1 pt-2 border-t border-nex-gray-100 w-full"
                    >
                      <Plus className="w-3.5 h-3.5" /> Gerar Aditivo
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : tipoDoc ? (
        <div className="bg-white border border-nex-gray-200 rounded-xl flex items-center justify-center py-16">
          <p className="text-sm font-bold text-nex-gray-300">Nenhum campo configurado para este tipo.</p>
        </div>
      ) : null}

      {/* ── Aditivo ── */}
      {mostraAditivo && (
        <div className="mt-5 bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-nex-gray-100">
            <p className="text-xs font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Aditivo Contratual</p>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400">Tipo de Aditivo *</label>
              <Select value={tipoAditivo} onValueChange={v => { setTipoAditivo(v); setAditivoValues({}) }}>
                <SelectTrigger><SelectValue placeholder="Escolha o tipo de aditivo..." /></SelectTrigger>
                <SelectContent>
                  {TIPOS_ADITIVO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {tipoAditivo && (
              <>
                <div className="px-3 py-2 bg-nex-gray-50 rounded-lg text-xs font-bold text-nex-gray-600">
                  Os dados do contrato de <span className="text-nex-black">{formValues.nome_cliente}</span> serão incorporados automaticamente.
                </div>
                {camposAditivo.map(campo => renderCampo(campo, aditivoValues, setAditivoField))}
                <Button className="w-full gap-2" onClick={handleGerarAditivo} disabled={loading}>
                  <FileText className="h-4 w-4" />
                  {loading ? 'Gerando...' : 'Gerar Aditivo'}
                </Button>
              </>
            )}
            {aditivoGerado && (
              <div className="flex gap-3 pt-2 border-t border-nex-gray-100">
                {aditivoGerado.docUrl && (
                  <button onClick={() => baixarDocxBlob(aditivoGerado.docUrl!, `${tipoAditivo}_${Date.now()}.docx`)} className="flex items-center gap-1.5 text-xs font-bold text-nex-black hover:text-nex-gray-600">
                    <Download className="w-3.5 h-3.5" /> Baixar Aditivo
                  </button>
                )}
                {aditivoGerado.driveUrl && (
                  <a href={aditivoGerado.driveUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-nex-black hover:text-nex-gray-600">
                    <ExternalLink className="w-3.5 h-3.5" /> Ver no Drive
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
