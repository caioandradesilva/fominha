# Fominha

Quem come mais no rodízio? Agora tem placar.

Versão zero: web app (PWA) para o rodízio de teste de 26 nov 2026.
Plano, decisões e diário de progresso ficam no PRD do projeto.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Supabase: Postgres, Auth (login anônimo com apelido), Storage, Realtime
- API de visão da Anthropic para contar as peças (rota do servidor)
- Vercel para hospedagem

## Rodar localmente

```bash
cp .env.example .env.local   # preencha com as chaves do Supabase
npm install
npm run dev
```

## Banco de dados

O esquema está em `supabase/migrations/`. Cada arquivo é rodado uma vez, em ordem,
no SQL Editor do Supabase.

## Estrutura

```
app/                 páginas e rotas (App Router)
components/          telas e componentes (Logo, Welcome, Home…)
lib/supabase/        clientes do Supabase (navegador e servidor)
proxy.ts             renova a sessão a cada navegação
supabase/migrations  tabelas, regras de acesso (RLS), bucket de fotos
public/icons         ícones do PWA
```
