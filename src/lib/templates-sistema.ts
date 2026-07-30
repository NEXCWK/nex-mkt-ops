/**
 * Modelos padrão do sistema (arquivos pré-carregados em `_template-source/`).
 * Lista compartilhada entre o endpoint de (re)importação e a UI de Templates,
 * para saber quais tipos podem ser reimportados a partir do repositório.
 */
export interface TemplateSistema {
  tipo: string
  nome: string
  arquivo: string
}

export const TEMPLATES_SISTEMA: TemplateSistema[] = [
  { tipo: 'escritorio_privativo_nex_house',       nome: 'Escritório Privativo — Nex House',            arquivo: 'escritorio_privativo_nex_house.docx' },
  { tipo: 'escritorio_privativo_francisco_rocha', nome: 'Escritório Privativo — Francisco Rocha',       arquivo: 'escritorio_privativo_francisco_rocha.docx' },
  { tipo: 'nex_house_atrium',                     nome: 'Nex House — Atrium',                          arquivo: 'nex_house_atrium.docx' },
  { tipo: 'nex_house_gallery',                    nome: 'Nex House — Gallery',                         arquivo: 'nex_house_gallery.docx' },
  { tipo: 'nex_house_atrium_anual',               nome: 'Nex House — Assinatura Atrium Anual',          arquivo: 'nex_house_atrium_anual.docx' },
  { tipo: 'nex_house_gallery_anual',              nome: 'Nex House — Assinatura Gallery Anual',         arquivo: 'nex_house_gallery_anual.docx' },
  { tipo: 'termo_eventos',                        nome: 'Termo Compromisso — Eventos (Externo)',        arquivo: 'termo_eventos.docx' },
  { tipo: 'termo_eventos_residentes',             nome: 'Termo Compromisso — Eventos (Residentes)',     arquivo: 'termo_eventos_residentes.docx' },
  { tipo: 'termo_diaria_reuniao',                 nome: 'Termo Compromisso — Diária e Reunião',         arquivo: 'termo_diaria_reuniao.docx' },
  { tipo: 'escritorio_virtual_fiscal',            nome: 'Escritório Virtual — Endereço Fiscal',         arquivo: 'escritorio_virtual_fiscal.docx' },
  { tipo: 'escritorio_virtual_fiscal_oab',        nome: 'Escritório Virtual — Endereço Fiscal OAB',     arquivo: 'escritorio_virtual_fiscal_oab.docx' },
  { tipo: 'escritorio_virtual_comercial',         nome: 'Escritório Virtual — Endereço Comercial',      arquivo: 'escritorio_virtual_comercial.docx' },
  { tipo: 'escritorio_virtual_comercial_oab',     nome: 'Escritório Virtual — Endereço Comercial OAB',  arquivo: 'escritorio_virtual_comercial_oab.docx' },
  { tipo: 'aditivo_ev_pf_para_pj',                nome: 'Aditivo EV — Troca de Polo PF → PJ',           arquivo: 'aditivo_ev_pf_para_pj.docx' },
  { tipo: 'aditivo_ev_pj_para_pj',                nome: 'Aditivo EV — Troca de Polo PJ → PJ',           arquivo: 'aditivo_ev_pj_para_pj.docx' },
  { tipo: 'aditivo_ev_alteracao_endereco',        nome: 'Aditivo EV — Troca de Endereço',               arquivo: 'aditivo_ev_alteracao_endereco.docx' },
]

export const TIPOS_TEMPLATES_SISTEMA = new Set(TEMPLATES_SISTEMA.map(t => t.tipo))
