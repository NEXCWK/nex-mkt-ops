export type Perfil = 'operador' | 'gestor' | 'admin'
export type Unidade = 'nex_house' | 'francisco_rocha'
export type StatusEspaco = 'disponivel' | 'ocupado' | 'manutencao'
export type TipoEspaco = 'escritorio_privativo' | 'mesa_fixa' | 'sala_reuniao'

export interface Usuario {
  id: string
  email: string
  nome: string | null
  perfil: Perfil
  ativo: boolean
  created_at: string
}

export interface Cliente {
  id: string
  nome: string
  email: string | null
  cpf_cnpj: string | null
  unidade: Unidade | null
  drive_folder_id: string | null
  created_at: string
}

export interface CampoTemplate {
  nome: string
  tipo: 'texto' | 'data' | 'valor' | 'selecao' | 'numero' | 'textarea'
  obrigatorio: boolean
  placeholder?: string
  opcoes?: string[]
}

export interface TemplateDocumento {
  id: string
  tipo: string
  nome: string
  unidade: Unidade | null
  arquivo_url: string | null
  campos_json: CampoTemplate[]
  versao: number
  criado_por: string | null
  created_at: string
}

export interface TemplateEmail {
  id: string
  nome: string
  tipo: string
  corpo_html: string
  campos_json: CampoTemplate[]
  versao: number
  criado_por: string | null
  created_at: string
}

export interface DocumentoGerado {
  id: string
  cliente_id: string
  template_id: string
  tipo: string
  arquivo_url: string | null
  drive_url: string | null
  operador_email: string
  created_at: string
  clientes?: Cliente
  templates_documentos?: TemplateDocumento
}

export interface EmailEnviado {
  id: string
  template_id: string | null
  cliente_id: string | null
  destinatario: string
  copia_json: string[]
  corpo_final: string
  operador_email: string
  unidade: Unidade | null
  drive_url: string | null
  sent_at: string
  clientes?: Cliente
  templates_email?: TemplateEmail
}

export interface Espaco {
  id: string
  nome: string
  tipo: TipoEspaco
  unidade: Unidade
  status: StatusEspaco
  preco: number | null
  churn_sinalizado: boolean
  churn_data: string | null
  cliente_atual_id: string | null
  clientes?: Cliente
}

export interface LeadInfluenciador {
  id: string
  nome: string
  influenciador: string | null
  status: string
  unidade: Unidade | null
  created_at: string
}

export interface Parceiro {
  id: string
  nome: string
  canal: string | null
  volume: number | null
  status: string | null
}

export const UNIDADE_LABELS: Record<Unidade, string> = {
  nex_house: 'Nex House',
  francisco_rocha: 'Francisco Rocha',
}

export const TIPO_ESPACO_LABELS: Record<TipoEspaco, string> = {
  escritorio_privativo: 'Escritório Privativo',
  mesa_fixa: 'Mesa Fixa',
  sala_reuniao: 'Sala de Reunião',
}

export const STATUS_ESPACO_LABELS: Record<StatusEspaco, string> = {
  disponivel: 'Disponível',
  ocupado: 'Ocupado',
  manutencao: 'Manutenção',
}

export const TIPOS_CONTRATO = [
  // Escritório Privativo
  { value: 'escritorio_privativo_nex_house',      label: 'Escritório Privativo — Nex House' },
  { value: 'escritorio_privativo_francisco_rocha', label: 'Escritório Privativo — Francisco Rocha' },
  // Nex House
  { value: 'nex_house_atrium',  label: 'Nex House — Atrium' },
  { value: 'nex_house_gallery', label: 'Nex House — Gallery' },
  // Termos de Compromisso
  { value: 'termo_eventos',            label: 'Termo de Compromisso — Eventos (Externo)' },
  { value: 'termo_eventos_residentes', label: 'Termo de Compromisso — Eventos (Residentes)' },
  { value: 'termo_diaria_reuniao',     label: 'Termo de Compromisso — Diária e Reunião' },
  // Escritório Virtual
  { value: 'escritorio_virtual_fiscal',         label: 'Escritório Virtual — Endereço Fiscal' },
  { value: 'escritorio_virtual_fiscal_oab',     label: 'Escritório Virtual — Endereço Fiscal OAB' },
  { value: 'escritorio_virtual_comercial',      label: 'Escritório Virtual — Endereço Comercial' },
  { value: 'escritorio_virtual_comercial_oab',  label: 'Escritório Virtual — Endereço Comercial OAB' },
]

export const TIPOS_ADITIVO = [
  { value: 'aditivo_ev_pf_para_pj', label: 'Aditivo EV — Troca de Polo PF → PJ' },
  { value: 'aditivo_ev_pj_para_pj', label: 'Aditivo EV — Troca de Polo PJ → PJ' },
]

export const TIPOS_PROPOSTA = [
  { value: 'escritorios_privativos', label: 'Escritórios Privativos' },
  { value: 'eventos', label: 'Eventos' },
]

export const MODELOS_EMAIL = [
  { value: 'bastao_eventos', label: 'Passagem de Bastão — Eventos', tipo: 'bastao' },
  { value: 'bastao_novo_cliente', label: 'Passagem de Bastão — Novo Cliente (Reunião acima de 4h)', tipo: 'bastao' },
  { value: 'bastao_escritorio', label: 'Passagem de Bastão — Escritório Privativo / Mesa Fixa / Nex House', tipo: 'bastao' },
  { value: 'ev_pf_pj', label: 'Aditivo PF para PJ', tipo: 'ev' },
  { value: 'ev_troca_endereco', label: 'Aditivo Troca de Endereço', tipo: 'ev' },
  { value: 'ev_documentos', label: 'Envio de Documentos', tipo: 'ev' },
]

export const COPIAS_FIXAS = ['felipe@nex.work', 'lenise@nex.work']
export const COPIAS_POR_UNIDADE: Record<Unidade, string> = {
  nex_house: 'altieres@nex.work',
  francisco_rocha: 'edmilson@nex.work',
}
