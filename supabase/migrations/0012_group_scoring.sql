-- v0.2 item 5: pontuação do grupo. "pecas" (1 peça = 1 ponto, padrão) ou "pontos" com peso por tipo.
-- Formato: {"modo": "pecas"} ou {"modo": "pontos", "pesos": {"Temaki": 3, "Uramaki": 1, ...}}
-- Só admin altera (política groups_update_admin já existe).
alter table public.groups
  add column scoring jsonb not null default '{"modo": "pecas"}'::jsonb
  check (scoring ->> 'modo' in ('pecas', 'pontos'));
