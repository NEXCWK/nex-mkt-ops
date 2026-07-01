-- Habilita extensão UUID
create extension if not exists "uuid-ossp";

-- Usuários autorizados (whitelist + perfis)
create table if not exists usuarios (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  nome text,
  perfil text check (perfil in ('operador', 'gestor', 'admin')) default 'operador',
  ativo boolean default true,
  created_at timestamptz default now()
);

-- Clientes
create table if not exists clientes (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  email text,
  cpf_cnpj text,
  unidade text check (unidade in ('nex_house', 'francisco_rocha')),
  drive_folder_id text,
  created_at timestamptz default now()
);

-- Templates de documentos (.docx / .pptx)
create table if not exists templates_documentos (
  id uuid primary key default uuid_generate_v4(),
  tipo text not null,
  nome text not null,
  unidade text,
  arquivo_url text,
  campos_json jsonb default '[]'::jsonb,
  versao integer default 1,
  criado_por text references usuarios(email) on delete set null,
  created_at timestamptz default now()
);

-- Templates de e-mail
create table if not exists templates_email (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  tipo text not null,
  corpo_html text default '',
  campos_json jsonb default '[]'::jsonb,
  versao integer default 1,
  criado_por text references usuarios(email) on delete set null,
  created_at timestamptz default now()
);

-- Documentos gerados
create table if not exists documentos_gerados (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid references clientes(id) on delete set null,
  template_id uuid references templates_documentos(id) on delete set null,
  tipo text,
  arquivo_url text,
  drive_url text,
  operador_email text references usuarios(email) on delete set null,
  created_at timestamptz default now()
);

-- Log de e-mails enviados (imutável — sem delete/update)
create table if not exists emails_enviados (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid references templates_email(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  destinatario text not null,
  copia_json jsonb default '[]'::jsonb,
  corpo_final text,
  operador_email text not null,
  unidade text check (unidade in ('nex_house', 'francisco_rocha')),
  drive_url text,
  sent_at timestamptz default now()
);

-- Espaços físicos
create table if not exists espacos (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  tipo text check (tipo in ('escritorio_privativo', 'mesa_fixa', 'sala_reuniao')),
  unidade text check (unidade in ('nex_house', 'francisco_rocha')),
  status text check (status in ('disponivel', 'ocupado', 'manutencao')) default 'disponivel',
  preco numeric,
  churn_sinalizado boolean default false,
  churn_data date,
  cliente_atual_id uuid references clientes(id) on delete set null
);

-- Leads via influenciadores
create table if not exists leads_influenciadores (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  influenciador text,
  status text default 'novo',
  unidade text check (unidade in ('nex_house', 'francisco_rocha')),
  created_at timestamptz default now()
);

-- Parceiros e marketplaces
create table if not exists parceiros (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  canal text,
  volume integer,
  status text default 'ativo'
);

-- RLS: habilita em todas as tabelas (políticas devem ser configuradas conforme necessário)
alter table usuarios enable row level security;
alter table clientes enable row level security;
alter table templates_documentos enable row level security;
alter table templates_email enable row level security;
alter table documentos_gerados enable row level security;
alter table emails_enviados enable row level security;
alter table espacos enable row level security;
alter table leads_influenciadores enable row level security;
alter table parceiros enable row level security;

-- Políticas permissivas para service_role (acesso total via backend)
create policy "Service role full access" on usuarios for all using (true);
create policy "Service role full access" on clientes for all using (true);
create policy "Service role full access" on templates_documentos for all using (true);
create policy "Service role full access" on templates_email for all using (true);
create policy "Service role full access" on documentos_gerados for all using (true);
create policy "Service role full access" on emails_enviados for all using (true);
create policy "Service role full access" on espacos for all using (true);
create policy "Service role full access" on leads_influenciadores for all using (true);
create policy "Service role full access" on parceiros for all using (true);

-- Registro de reservas de salas de reunião
create table if not exists registro_reservas (
  id uuid primary key default uuid_generate_v4(),
  tipo text check (tipo in ('primeira_vez', 'quatro_horas', 'primeiro_uso_diaria', 'primeiro_uso_access_pass')) not null,
  nome_cliente text not null,
  data date not null,
  horario text not null,
  nome_sala text,
  quantidade_pessoas integer,
  observacoes text,
  unidade text check (unidade in ('nex_house', 'francisco_rocha')) not null,
  operador_email text not null,
  created_at timestamptz default now()
);

-- Registro de visitas de leads
create table if not exists registro_visitas (
  id uuid primary key default uuid_generate_v4(),
  nome_lead text not null,
  data date not null,
  hora text not null,
  produto_interesse text not null,
  unidade text check (unidade in ('nex_house', 'francisco_rocha')),
  compareceu boolean default false,
  operador_email text not null,
  created_at timestamptz default now()
);

alter table registro_reservas enable row level security;
alter table registro_visitas enable row level security;
drop policy if exists "Service role full access" on registro_reservas;
drop policy if exists "Service role full access" on registro_visitas;
create policy "Service role full access" on registro_reservas for all using (true);
create policy "Service role full access" on registro_visitas for all using (true);

-- Bucket de storage para templates
insert into storage.buckets (id, name, public) values ('templates', 'templates', false) on conflict do nothing;

-- Avaliação de Atendimentos / Telefonemas: lotes importados (PDF, CSV, Excel ou texto colado)
create table if not exists avaliacoes_lotes (
  id uuid primary key default uuid_generate_v4(),
  tipo text check (tipo in ('atendimento', 'telefonema')) not null,
  nome_arquivo text,
  total_conversas integer default 0,
  nota_media numeric,
  operador_email text not null,
  created_at timestamptz default now()
);

-- Conversas/atendimentos individuais extraídos de cada lote, já atribuídos ao atendente
create table if not exists avaliacoes_conversas (
  id uuid primary key default uuid_generate_v4(),
  lote_id uuid references avaliacoes_lotes(id) on delete cascade,
  tipo text check (tipo in ('atendimento', 'telefonema')) not null,
  atendente text,
  data date,
  nota numeric,
  resumo text,
  kpis jsonb,
  pontos_atencao jsonb,
  palavras_chave jsonb,
  trecho text,
  created_at timestamptz default now()
);

create index if not exists idx_avaliacoes_conversas_lote on avaliacoes_conversas(lote_id);
create index if not exists idx_avaliacoes_conversas_atendente on avaliacoes_conversas(atendente);
create index if not exists idx_avaliacoes_conversas_tipo_data on avaliacoes_conversas(tipo, data);

alter table avaliacoes_lotes enable row level security;
alter table avaliacoes_conversas enable row level security;
drop policy if exists "Service role full access" on avaliacoes_lotes;
drop policy if exists "Service role full access" on avaliacoes_conversas;
create policy "Service role full access" on avaliacoes_lotes for all using (true);
create policy "Service role full access" on avaliacoes_conversas for all using (true);

-- Modelos de referência para o Criador de LP e o Criador de Criativos (HTML/CSS/JS enviados pelo time)
create table if not exists modelos_referencia (
  id uuid primary key default uuid_generate_v4(),
  contexto text check (contexto in ('lp', 'criativo')) not null,
  nome text not null,
  html text,
  css text,
  js text,
  operador_email text not null,
  created_at timestamptz default now()
);

-- Repositório/histórico de LPs e criativos escolhidos pelo usuário entre as opções geradas
create table if not exists criacoes_historico (
  id uuid primary key default uuid_generate_v4(),
  contexto text check (contexto in ('lp', 'criativo')) not null,
  produto text,
  vigencia text,
  desconto text,
  titulo text,
  descricao text,
  conteudo jsonb not null,
  operador_email text not null,
  created_at timestamptz default now()
);

create index if not exists idx_modelos_referencia_contexto on modelos_referencia(contexto);
create index if not exists idx_criacoes_historico_contexto on criacoes_historico(contexto);

alter table modelos_referencia enable row level security;
alter table criacoes_historico enable row level security;
drop policy if exists "Service role full access" on modelos_referencia;
drop policy if exists "Service role full access" on criacoes_historico;
create policy "Service role full access" on modelos_referencia for all using (true);
create policy "Service role full access" on criacoes_historico for all using (true);

-- Log das execuções automáticas (cron) de exportação + avaliação do RD Conversas
create table if not exists avaliacao_cron_log (
  id uuid primary key default uuid_generate_v4(),
  tipo text default 'atendimento',
  janela_de timestamptz,
  janela_ate timestamptz,
  total_conversas integer default 0,
  lote_id uuid,
  status text,       -- ok | vazio | erro
  detalhe text,
  created_at timestamptz default now()
);

create index if not exists idx_avaliacao_cron_log_created on avaliacao_cron_log(created_at desc);

alter table avaliacao_cron_log enable row level security;
drop policy if exists "Service role full access" on avaliacao_cron_log;
create policy "Service role full access" on avaliacao_cron_log for all using (true);
