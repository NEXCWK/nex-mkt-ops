# Nex Ops

Sistema interno de gestão operacional e comunicação do Nex Coworking.

## Stack
- **Frontend/Backend:** Next.js 15 (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui (Nex Design System)
- **Auth:** NextAuth.js v4 + Google OAuth 2.0
- **Banco:** Supabase (PostgreSQL)
- **E-mails:** Gmail API (envia como o operador logado)
- **Documentos:** Google Drive (Service Account)
- **Deploy:** Railway

## Setup

1. Clone o repositório
2. Copie `.env.example` para `.env.local` e preencha as variáveis
3. Execute o schema SQL em `supabase/schema.sql` no Supabase Dashboard
4. Adicione o primeiro usuário admin manualmente na tabela `usuarios`

```bash
npm install
npm run dev
```

## Variáveis de Ambiente

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://seu-dominio.railway.app
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
```

## Módulos

1. **Contratos e Termos** — Gera .docx com substituição de `{{marcadores}}`
2. **Propostas** — Gera .pptx para Escritórios Privativos e Eventos
3. **E-mails Operacionais** — Disparo via Gmail API com cópias automáticas
4. **Dashboard CCO** — Ocupação, receita, churn
5. **Log de E-mails** — Registro imutável (somente gestor)
6. **Templates** — Gestão de modelos (somente gestor)
7. **Usuários** — Whitelist de acessos (somente admin)
