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
  tipo text check (tipo in ('primeira_vez', 'quatro_horas')) not null,
  nome_cliente text not null,
  data date not null,
  horario text not null,
  nome_sala text not null,
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
  compareceu boolean default false,
  operador_email text not null,
  created_at timestamptz default now()
);

alter table registro_reservas enable row level security;
alter table registro_visitas enable row level security;
create policy "Service role full access" on registro_reservas for all using (true);
create policy "Service role full access" on registro_visitas for all using (true);

-- Bucket de storage para templates
insert into storage.buckets (id, name, public) values ('templates', 'templates', false) on conflict do nothing;
