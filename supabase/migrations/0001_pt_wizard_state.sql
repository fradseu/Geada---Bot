-- pt_wizard_state: guarda o progresso de cada líder montando uma PT
-- (Passo 1 -> 2 -> 3), substituindo o Map em memória (`criacaoPT`) que o v1
-- usava. Necessário porque cada requisição da Edge Function é uma execução
-- isolada, sem memória compartilhada entre um clique e o próximo.

create table if not exists public.pt_wizard_state (
  lider_id text primary key,        -- snowflake do Discord, guardado como texto (evita perder precisão)
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

comment on table public.pt_wizard_state is
  'Estado do assistente de criação de PT (Passo 1-3) por líder do Discord. Uma linha = uma PT em construção.';

-- Só a Edge Function (via service_role, que ignora RLS) mexe nessa tabela.
-- RLS habilitado sem nenhuma política = acesso negado por padrão pra
-- qualquer chamada feita com a chave pública/anon.
alter table public.pt_wizard_state enable row level security;
