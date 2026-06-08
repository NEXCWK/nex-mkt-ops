export type GrupoEmail = 'Escritório Virtual' | 'Eventos' | 'Reunião'

export type TipoCampo = 'texto' | 'textarea' | 'data' | 'selecao'

export type CampoMarcador = {
  nome: string
  label: string
  tipo: TipoCampo
  opcoes?: string[]
  global?: boolean
}

export type EmailTemplate = {
  id: string
  grupo: GrupoEmail
  titulo: string
  trigger: string
  assunto: string
  marcadores: string[]
  corpo: string
  notaInterna?: string
}

export const MARCADORES_DEF: Record<string, CampoMarcador> = {
  nome_atendente:          { nome: 'nome_atendente',          label: 'Nome do Atendente',           tipo: 'texto',    global: true },
  assinatura:              { nome: 'assinatura',              label: 'Assinatura',                  tipo: 'textarea', global: true },
  nome_cliente:            { nome: 'nome_cliente',            label: 'Nome do Cliente',             tipo: 'texto' },
  nome_empresa:            { nome: 'nome_empresa',            label: 'Nome da Empresa',             tipo: 'texto' },
  data_adesao:             { nome: 'data_adesao',             label: 'Data de Adesão',              tipo: 'data' },
  fiscal_ou_comercial:     { nome: 'fiscal_ou_comercial',     label: 'Fiscal ou Comercial',         tipo: 'selecao', opcoes: ['Fiscal', 'Comercial'] },
  semestral_ou_mensal:     { nome: 'semestral_ou_mensal',     label: 'Semestral ou Mensal',         tipo: 'selecao', opcoes: ['Semestral', 'Mensal'] },
  valor:                   { nome: 'valor',                   label: 'Valor do Plano',              tipo: 'texto' },
  data_envio_boleto:       { nome: 'data_envio_boleto',       label: 'Data de Envio da Fatura',     tipo: 'data' },
  canal_contato:           { nome: 'canal_contato',           label: 'Canal do Cancelamento',       tipo: 'selecao', opcoes: ['e-mail', 'telefone', 'WhatsApp'] },
  link_imagens:            { nome: 'link_imagens',            label: 'Link das Imagens (HD)',       tipo: 'texto' },
  numero_caixa_postal:     { nome: 'numero_caixa_postal',     label: 'Número da Caixa Postal',      tipo: 'texto' },
  descricao_espaco:        { nome: 'descricao_espaco',        label: 'Espaço Reservado',            tipo: 'texto' },
  descricao_sala:          { nome: 'descricao_sala',          label: 'Sala Reservada',              tipo: 'texto' },
  data_evento:             { nome: 'data_evento',             label: 'Data do Evento / Reunião',    tipo: 'data' },
  horario_evento:          { nome: 'horario_evento',          label: 'Horário do Evento',           tipo: 'texto' },
  capacidade:              { nome: 'capacidade',              label: 'Capacidade (participantes)',  tipo: 'texto' },
  formato_evento:          { nome: 'formato_evento',          label: 'Formato do Evento',           tipo: 'texto' },
  nome_unidade:            { nome: 'nome_unidade',            label: 'Unidade',                     tipo: 'selecao', opcoes: ['Unidade Francisco Rocha', 'Nex House'] },
  nome_responsavel_unidade:{ nome: 'nome_responsavel_unidade',label: 'Gerente da Unidade',          tipo: 'selecao', opcoes: ['Edmílson', 'Altieres'] },
  num_participantes:       { nome: 'num_participantes',       label: 'Nº de Participantes',         tipo: 'texto' },
  coffee_break:            { nome: 'coffee_break',            label: 'Coffee-Break',                tipo: 'texto' },
  estacionamento:          { nome: 'estacionamento',          label: 'Estacionamento',              tipo: 'texto' },
  detalhes_adicionais:     { nome: 'detalhes_adicionais',     label: 'Detalhes Adicionais',         tipo: 'textarea' },
  nome_responsavel:        { nome: 'nome_responsavel',        label: 'Nome do Responsável',         tipo: 'texto' },
  telefone_responsavel:    { nome: 'telefone_responsavel',    label: 'Telefone do Responsável',     tipo: 'texto' },
  email_responsavel:       { nome: 'email_responsavel',       label: 'E-mail do Responsável',       tipo: 'texto' },
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  // ─── ESCRITÓRIO VIRTUAL ──────────────────────────────────────────────────────
  {
    id: 'ev-01-pos-adesao',
    grupo: 'Escritório Virtual',
    titulo: 'Pós-Adesão',
    trigger: 'Logo após a adesão do cliente',
    assunto: 'Bem-vindo ao Escritório Virtual Nex!',
    marcadores: ['nome_cliente', 'nome_atendente'],
    corpo: `Olá, {{nome_cliente}}! Como vai?

{{nome_atendente}}, do time Nex, aqui.

Recebemos sua adesão ao plano de Escritório Virtual pelo nosso site e ficamos muito felizes em ter você conosco. Para dar continuidade ao processo e confirmar sua contratação, precisamos que você retorne o contato e nos envie a documentação necessária.

Se a contratação foi realizada via CNPJ:

- Última cópia do contrato social da empresa
- Cartão CNPJ
- Documento de identificação com foto do representante legal
- Comprovante de endereço do representante legal (mês atual ou anterior)
- E-mail do representante legal
- E-mail de testemunha para assinatura do contrato

Se a contratação foi realizada via CPF:

- Documento de identificação com foto do futuro representante legal
- Comprovante de endereço do futuro representante legal (mês atual ou anterior)
- E-mail do futuro representante legal
- E-mail de testemunha para assinatura do contrato

Assim que recebermos os documentos, encaminhamos a fatura para pagamento e o contrato para assinatura. Você pode conferir uma minuta do contrato no link: nex.work/nex_termodeaceite_escritoriovirtual.pdf

Após a confirmação do pagamento e a assinatura do contrato, enviaremos os documentos e as imagens de nossos espaços de acordo com o plano contratado.

Ficamos no aguardo. Seja muito bem-vindo!

Nex | o futuro do trabalho se manifesta aqui.`,
  },
  {
    id: 'ev-02-follow-docs',
    grupo: 'Escritório Virtual',
    titulo: 'Follow-up — Envio de Documentos',
    trigger: 'Alguns dias após o e-mail 01 sem retorno',
    assunto: '',
    marcadores: ['nome_cliente', 'nome_atendente'],
    corpo: `Olá, {{nome_cliente}}! Como vai?

{{nome_atendente}}, do time Nex, aqui.

Há alguns dias recebemos sua adesão ao plano de Escritório Virtual e enviamos uma mensagem solicitando os documentos necessários para dar continuidade ao processo.

Ficamos no aguardo do seu retorno para que possamos concluir a contratação.

Um grande abraço!

Nex | o futuro do trabalho se manifesta aqui.`,
  },
  {
    id: 'ev-03-follow-pagamento',
    grupo: 'Escritório Virtual',
    titulo: 'Follow-up — Pagamento Pendente',
    trigger: '2 dias após o último follow-up sem pagamento identificado',
    assunto: 'Olá! Ainda não identificamos o seu pagamento.',
    marcadores: ['nome_cliente', 'data_adesao', 'fiscal_ou_comercial', 'semestral_ou_mensal', 'valor', 'data_envio_boleto', 'assinatura'],
    corpo: `Olá, {{nome_cliente}}! Tudo bem?

No dia {{data_adesao}}, você realizou a adesão ao plano de Escritório Virtual Nex, na opção {{fiscal_ou_comercial}}, na modalidade {{semestral_ou_mensal}}, no valor de {{valor}}.

Até o momento, o pagamento da fatura enviada no dia {{data_envio_boleto}} ainda não foi identificado em nosso sistema, o que impede a ativação do seu plano.

O prazo máximo para a efetivação do pagamento é de 24 horas a partir do recebimento desta mensagem. Após esse período, o contrato será cancelado automaticamente.

Ficamos à disposição para qualquer dúvida e esperamos resolver isso logo para ter você como nosso cliente.

Abraços,
{{assinatura}}`,
  },
  {
    id: 'ev-04-cancelamento',
    grupo: 'Escritório Virtual',
    titulo: 'Cancelamento Automático por Não Pagamento',
    trigger: '1 dia após o e-mail 03 sem pagamento',
    assunto: 'Seu plano de Escritório Virtual foi cancelado.',
    marcadores: ['nome_cliente', 'data_envio_boleto', 'assinatura'],
    corpo: `Olá, {{nome_cliente}}! Tudo bem?

Nos últimos dias, você contratou um plano de Escritório Virtual conosco. Como o pagamento da fatura enviada no dia {{data_envio_boleto}} não foi identificado em nosso sistema, e conforme informamos em nossa última mensagem, o cancelamento automático do contrato foi realizado.

Caso queira contratar um novo plano, ficamos à disposição para iniciar o processo novamente. Será um prazer ter você conosco.

Qualquer dúvida, basta nos contatar.

Abraços,
{{assinatura}}`,
  },
  {
    id: 'ev-05-docs-fiscal',
    grupo: 'Escritório Virtual',
    titulo: 'Envio de Documentos — Endereço Fiscal',
    trigger: 'Após confirmação de pagamento — plano fiscal',
    assunto: 'Aqui estão seus documentos para Endereço Fiscal e onboarding!',
    marcadores: ['nome_cliente', 'assinatura'],
    corpo: `Olá, {{nome_cliente}}! Tudo bem?

Recebemos a confirmação do seu pagamento. A partir de hoje, você faz parte da comunidade Nex! Seja muito bem-vindo.

Em anexo, segue toda a documentação necessária para a formalização da sua empresa.

Nossa indicação fiscal: 23.037.017000-3

Também enviamos três documentos que exemplificam os procedimentos.

Importante: em caso de contratação via CPF, ao realizar a troca de endereço ou a constituição da empresa, pedimos que nos envie o cartão CNPJ para realizarmos a atualização no sistema.

Importante: a assinatura do contrato nominal é obrigatória e condicionante para a utilização do endereço para fins fiscais.

Confira também o material de onboarding completo do plano de Escritório Virtual Nex, com todas as informações sobre o seu plano, funcionalidades e facilidades.

Em anexo está o contrato nominal assinado por todos.

O Google solicita um vídeo gravado pelo próprio celular do responsável pela empresa para verificar o endereço comercial. Para isso, você pode comparecer diretamente à unidade.

Nosso horário de funcionamento é de segunda a sexta, das 8h às 19h. Qualquer dúvida, pode nos chamar pelo WhatsApp: (41) 3122-8801.

Ficamos à disposição!

Abraços,
{{assinatura}}`,
  },
  {
    id: 'ev-06-imagens-comercial',
    grupo: 'Escritório Virtual',
    titulo: 'Envio de Imagens — Endereço Comercial',
    trigger: 'Após confirmação de pagamento — plano comercial',
    assunto: 'Aqui estão suas imagens para Endereço Comercial!',
    marcadores: ['nome_cliente', 'nome_atendente', 'link_imagens', 'assinatura'],
    corpo: `Olá, {{nome_cliente}}! Tudo bem?

{{nome_atendente}}, do time Nex, aqui.

Recebemos a confirmação do seu pagamento no plano de Escritório Virtual — Endereço Comercial. A partir de agora, você faz parte da nossa comunidade! Seja muito bem-vindo.

Em anexo, seguem as imagens dos nossos espaços para uso comercial em seu site, cartões e outros materiais.

No link a seguir, você pode fazer o download em alta definição: {{link_imagens}}

O Google solicita um vídeo gravado pelo próprio celular do responsável pela empresa para verificar o endereço comercial. Para isso, você pode comparecer diretamente à sua unidade.

Nosso horário de funcionamento é de segunda a sexta, das 8h às 19h. Qualquer dúvida, pode nos chamar pelo WhatsApp: (41) 3122-8801.

Desejamos muito sucesso!

Atenciosamente,
{{assinatura}}`,
  },
  {
    id: 'ev-07-info-adicionais',
    grupo: 'Escritório Virtual',
    titulo: 'Informações Adicionais Pós-Pagamento',
    trigger: 'Após ativação do plano — informações complementares',
    assunto: 'Informações adicionais do seu plano de Escritório Virtual',
    marcadores: ['nome_cliente', 'nome_atendente', 'numero_caixa_postal', 'assinatura'],
    corpo: `Olá, {{nome_cliente}}! Tudo bem?

{{nome_atendente}}, do time Nex, aqui.

Neste e-mail, trago algumas informações adicionais sobre o seu plano de Escritório Virtual recentemente contratado.

CAIXA POSTAL

Para facilitar a gestão das suas correspondências, disponibilizamos um número de Caixa Postal para você. Ela tem caráter organizacional.

Importante: não trabalhamos com estoque e recebemos apenas pequenos pacotes e correspondências em geral. Quando uma nova correspondência chegar, você será notificado por e-mail para realizar a retirada.

O número da sua caixa postal é: {{numero_caixa_postal}}

ÁREA DO CLIENTE

Temos uma área do cliente com informações sobre o seu plano, painel financeiro, agenda e agendamento online de salas de reunião e mesas de trabalho, entre outras funcionalidades.

Acesse pelo link: https://nex.conexa.app/index.php?r=site/login
Login: e-mail informado na adesão
Senha: enviada para o seu e-mail. Caso não tenha recebido, utilize a opção "Esqueci minha senha" na tela de login ou nos avise.

ADESÃO EM PESSOA FÍSICA

Caso a sua adesão tenha sido realizada como pessoa física para constituição futura de empresa, pedimos que nos envie os documentos abaixo assim que concluir o processo de abertura:

- Contrato social e RG (caso não conste no documento)
- Cartão CNPJ da empresa

Se o representante legal for diferente do titular original:

- Documento de identificação com foto do representante legal
- Comprovante de residência do representante legal

Com essas informações, conseguimos elaborar o contrato nominal entre o Nex e a empresa constituída, garantindo o recebimento correto de correspondências e demais efeitos jurídicos.

Ficamos à disposição para qualquer dúvida. Desejamos muito sucesso!

Atenciosamente,
{{assinatura}}`,
  },
  {
    id: 'ev-08-rescisao-fiscal',
    grupo: 'Escritório Virtual',
    titulo: 'Rescisão — Endereço Fiscal',
    trigger: 'Pedido de cancelamento recebido — plano fiscal',
    assunto: '',
    marcadores: ['nome_cliente', 'nome_atendente', 'canal_contato', 'assinatura'],
    notaInterna: 'Verificar modalidade antes de enviar. Se for Anual Parcelado, incluir no início do e-mail: "Ao contratar na modalidade Anual Parcelado, o valor é dividido em parcelas debitadas diretamente no cartão de crédito ao longo dos 12 meses do plano. Não realizamos devoluções nem suspendemos a cobrança das parcelas em caso de cancelamento antes do término da vigência."',
    corpo: `Olá, {{nome_cliente}}! Tudo bem?

{{nome_atendente}}, do Nex, aqui.

Que pena que você está cancelando o plano de Escritório Virtual. Poderia nos contar um pouco mais sobre o motivo?

Confirmamos o recebimento do seu pedido de cancelamento pelo {{canal_contato}}.

Para darmos continuidade ao processo, precisamos que você nos envie pelo menos um dos documentos abaixo:

- Cópia autenticada ou documento com chancela eletrônica da deferição da solicitação de alteração de endereço
- Baixa da empresa perante a Junta Comercial e a Prefeitura Municipal
- Cartão CNPJ com comprovação de baixa da empresa ou endereço atualizado

Em caso de contratação realizada como pessoa física:

- Documento de identificação com foto
- Comprovante de endereço

Somente com um dos documentos acima conseguiremos avançar no processo de cancelamento.

Nosso financeiro, em cópia neste e-mail, dará prosseguimento assim que recebermos a documentação.

Desejamos muito sucesso!

Abraços,
{{assinatura}}`,
  },
  {
    id: 'ev-09-rescisao-comercial',
    grupo: 'Escritório Virtual',
    titulo: 'Rescisão — Endereço Comercial',
    trigger: 'Pedido de cancelamento recebido — plano comercial',
    assunto: '',
    marcadores: ['nome_cliente', 'nome_atendente', 'canal_contato', 'assinatura'],
    corpo: `Olá, {{nome_cliente}}! Tudo bem?

{{nome_atendente}}, do Nex, aqui.

Que pena que você está cancelando o plano de Escritório Virtual. Poderia nos contar um pouco mais sobre o motivo?

Confirmamos o recebimento do seu pedido de cancelamento pelo {{canal_contato}}.

Para darmos continuidade ao processo, precisamos que você nos envie pelo menos um dos documentos abaixo:

- Print do Google Meu Negócio sem o endereço do Nex
- URL do site para verificação da utilização do endereço

Em caso de contratação realizada como pessoa física, basta nos informar o CPF vinculado ao contrato.

Somente com uma das confirmações acima conseguiremos avançar no processo de cancelamento.

Nosso financeiro, em cópia neste e-mail, dará prosseguimento assim que recebermos a documentação.

Desejamos muito sucesso!

Abraços,
{{assinatura}}`,
  },
  {
    id: 'ev-10-atualizacao-juridico',
    grupo: 'Escritório Virtual',
    titulo: 'Atualização de Dados — Jurídico',
    trigger: 'Após mudança de endereço — solicitação de documentos atualizados',
    assunto: '',
    marcadores: ['nome_cliente', 'nome_atendente', 'assinatura'],
    corpo: `Olá, {{nome_cliente}}! Tudo bem?

{{nome_atendente}}, do time Nex, aqui.

Após a mudança de endereço realizada, precisamos que você nos encaminhe os seguintes documentos para atualização do cadastro:

- Contrato social e RG (caso não conste no documento)
- Cartão CNPJ da empresa
- Comprovante de endereço do representante legal
- E-mail do representante legal
- E-mail de testemunha para assinatura do contrato (pode ser cônjuge, colega de trabalho ou pessoa próxima)

Se o representante legal tiver sido alterado, inclua também:

- Documento de identificação com foto do novo representante legal
- Comprovante de residência do novo representante legal

Ficamos no aguardo. Qualquer dúvida, estamos à disposição!

Atenciosamente,
{{assinatura}}`,
  },
  {
    id: 'ev-11-atualizacao-pf',
    grupo: 'Escritório Virtual',
    titulo: 'Atualização de Dados — Pessoa Física',
    trigger: 'Após constituição da empresa — cliente que aderiu como PF',
    assunto: '',
    marcadores: ['nome_cliente', 'nome_atendente', 'assinatura'],
    corpo: `Olá, {{nome_cliente}}! Como vai?

{{nome_atendente}}, do time Nex, aqui.

Assim que a sua empresa estiver constituída, pedimos a gentileza do envio dos documentos abaixo para que possamos elaborar o contrato formal com assinatura digital, dentro dos termos já acordados.

Isso também é importante para garantir que todas as correspondências que chegarem para a sua empresa sejam devidamente notificadas.

Os documentos necessários são:

- Contrato social
- Cartão CNPJ
- Comprovante de endereço do representante legal
- E-mail do representante legal
- E-mail de testemunha para assinatura do contrato

Se o representante legal for diferente do titular original:

- Documento de identificação com foto do novo representante legal
- Comprovante de residência do novo representante legal

Ficamos no aguardo. Qualquer dúvida, estamos à disposição!

Atenciosamente,
{{assinatura}}`,
  },

  // ─── EVENTOS ─────────────────────────────────────────────────────────────────
  {
    id: 'eventos-12-proposta',
    grupo: 'Eventos',
    titulo: 'Envio de Proposta',
    trigger: 'Após qualificação do lead de evento',
    assunto: '{{nome_empresa}} | Proposta — {{descricao_espaco}} em {{data_evento}} | {{nome_unidade}}',
    marcadores: ['nome_cliente', 'nome_empresa', 'nome_atendente', 'descricao_espaco', 'data_evento', 'horario_evento', 'capacidade', 'formato_evento', 'nome_unidade', 'assinatura'],
    corpo: `Olá, {{nome_cliente}}! Como vai?

{{nome_atendente}}, do time Nex, aqui.

Segue em anexo a proposta para a realização do seu evento conosco. A proposta é válida por 72 horas e, após esse prazo, a pré-reserva nas datas desejadas será liberada.

Data: {{data_evento}}
Horário: {{horario_evento}}
Capacidade: {{capacidade}}
Formato do evento: {{formato_evento}}

Em caso de aceite, basta responder positivamente a este e-mail. Pedimos também que nos envie seu nome completo, CPF, telefone, e-mail próprio e e-mail de testemunha para a assinatura do Termo de Compromisso.

Em seguida, encaminharemos a fatura para pagamento nas datas informadas na proposta.

CATERING

Não oferecemos o serviço de coffee-break, mas você está à vontade para trazer um fornecedor próprio. Algumas indicações de parceiros:

Rause Café & Vinho — Condições especiais para clientes Nex
(41) 99508-3587 — Adrielle | @rausecafe

Menuo
(41) 99273-2770 — Priscila | menuo.co

ESTACIONAMENTO

Temos o Estacionamento Nex Parking, rotativo e anexo à Unidade Batel (R. Francisco Rocha, 198), disponível para você, seus clientes e convidados.

Horário de funcionamento: 8h às 19h

Valores:
- Diária: R$ 32,00
- Período: R$ 26,40
- Hora: R$ 14,40

Não operamos no horário noturno nem na modalidade pernoite.

Se quiser reservar vagas para o seu evento, basta nos avisar com antecedência e encaminharemos a fatura.

Ficamos no aguardo. Qualquer dúvida, estamos à disposição!

Atenciosamente,
{{assinatura}}`,
  },
  {
    id: 'eventos-13-fup-proposta',
    grupo: 'Eventos',
    titulo: 'Follow-up de Proposta',
    trigger: 'Após envio da proposta sem resposta',
    assunto: '',
    marcadores: ['nome_cliente', 'nome_atendente', 'assinatura'],
    corpo: `Olá, {{nome_cliente}}! Tudo bem?

{{nome_atendente}}, do time Nex, aqui.

Você conseguiu analisar a proposta que enviamos? Qualquer dúvida ou ajuste, estamos à disposição.

Ficamos no aguardo!

Atenciosamente,
{{assinatura}}`,
  },
  {
    id: 'eventos-14-liberacao-prereserva',
    grupo: 'Eventos',
    titulo: 'Liberação de Pré-Reserva',
    trigger: 'Após tentativas de contato sem retorno — expiração do prazo',
    assunto: '',
    marcadores: ['nome_cliente', 'nome_atendente', 'assinatura'],
    corpo: `Olá, {{nome_cliente}}! Como vai?

{{nome_atendente}}, do time Nex, aqui.

Tentamos contato algumas vezes, mas não conseguimos retorno.

Conforme combinado, as pré-reservas nas datas desejadas foram liberadas.

Caso queira verificar a disponibilidade de novas datas ou receber uma proposta atualizada, fico à disposição. Será um prazer dar continuidade ao atendimento!

Atenciosamente,
{{assinatura}}`,
  },
  {
    id: 'eventos-15-passagem-bastao',
    grupo: 'Eventos',
    titulo: 'Passagem de Bastão',
    trigger: 'Após confirmação e pagamento do evento',
    assunto: '{{nome_empresa}} | Evento em {{data_evento}} | {{nome_unidade}}',
    marcadores: ['nome_cliente', 'nome_empresa', 'nome_atendente', 'nome_responsavel_unidade', 'nome_unidade', 'data_evento', 'horario_evento', 'num_participantes', 'formato_evento', 'coffee_break', 'estacionamento', 'detalhes_adicionais', 'assinatura'],
    corpo: `Olá, {{nome_cliente}}! Tudo bem?

{{nome_atendente}}, do time Nex, aqui.

Com a data do seu evento confirmada, gostaríamos de conectar você ao {{nome_responsavel_unidade}}, nosso gerente de relacionamento da {{nome_unidade}}. Ele acompanhará o seu evento em nosso espaço e está à disposição para dúvidas sobre layout, equipamentos e experiência no dia.

Resumo do seu evento:

Dia: {{data_evento}}
Horário: {{horario_evento}}
Número de participantes: {{num_participantes}}
Formato: {{formato_evento}}
Coffee-Break: {{coffee_break}}
Estacionamento: {{estacionamento}}
Detalhes adicionais: {{detalhes_adicionais}}

Para garantir uma experiência tranquila, precisamos de:

- Lista de acesso ao prédio: envie até 72 horas antes do evento com nome completo, RG, CPF e telefone de cada participante. Os participantes deverão portar documento oficial com foto para validação na entrada.
- Coffee-Break: se houver, indique a empresa fornecedora e o horário previsto.

Desconto no estacionamento: confirme a placa do seu veículo no tablet do hall de entrada para receber 20% de desconto automaticamente.

Para futuras datas, basta entrar em contato pelo e-mail ou pelo WhatsApp: (41) 3122-8801.

Esperamos que o seu evento seja um sucesso!

Grande abraço,
{{assinatura}}`,
  },

  // ─── REUNIÃO ─────────────────────────────────────────────────────────────────
  {
    id: 'reuniao-16-confirmacao',
    grupo: 'Reunião',
    titulo: 'Confirmação de Reserva',
    trigger: 'Após confirmação de reserva de sala',
    assunto: '{{nome_empresa}} | Reunião — {{descricao_sala}} em {{data_evento}} | {{nome_unidade}}',
    marcadores: ['nome_cliente', 'nome_empresa', 'nome_atendente', 'descricao_sala', 'data_evento', 'horario_evento', 'capacidade', 'nome_responsavel', 'telefone_responsavel', 'email_responsavel', 'nome_unidade', 'assinatura'],
    corpo: `Olá, {{nome_cliente}}! Como vai?

{{nome_atendente}}, do time Nex, aqui.

Segue o escopo da sua reserva:

Data: {{data_evento}}
Horário: {{horario_evento}}
Espaço: {{descricao_sala}}
Capacidade: {{capacidade}}
Responsável: {{nome_responsavel}} | {{telefone_responsavel}} | {{email_responsavel}}

Qualquer dúvida ou ajuste, estamos à disposição!

Atenciosamente,
{{assinatura}}`,
  },
]

export const GRUPOS: GrupoEmail[] = ['Escritório Virtual', 'Eventos', 'Reunião']

export function substituir(texto: string, campos: Record<string, string>): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (_, key) => campos[key] ?? `{{${key}}}`)
}

export function getCamposGlobais(): CampoMarcador[] {
  return Object.values(MARCADORES_DEF).filter(m => m.global)
}

export function getCamposContextuais(template: EmailTemplate): CampoMarcador[] {
  return template.marcadores
    .filter(m => !MARCADORES_DEF[m]?.global)
    .map(m => MARCADORES_DEF[m])
    .filter(Boolean)
}
