-- Dois cron jobs nativos do Postgres (pg_cron), sem precisar de servidor
-- externo nem de mais uma Edge Function pra isso:
--
-- 1) Limpa sessões de wizard "travadas" (pt_wizard_state) com mais de 1h sem
--    atualização, a cada 2h — garante que nenhum bug/crash/abandono deixe
--    lixo acumulando pra sempre, mesmo que trave de um jeito totalmente
--    inesperado.
-- 2) Faz um ping HTTP na Edge Function a cada 6h, só pra manter o projeto
--    "ativo" (projetos gratuitos do Supabase pausam sozinhos depois de ~7
--    dias sem nenhuma atividade).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'limpar-wizard-abandonado',
  '0 */2 * * *', -- a cada 2 horas
  $$
    delete from public.pt_wizard_state
    where atualizado_em < now() - interval '1 hour';
  $$
);

select cron.schedule(
  'ping-edge-function',
  '0 */6 * * *', -- a cada 6 horas
  $$
    select net.http_get('https://qroosefyfxefjrlhogrh.supabase.co/functions/v1/discord-bot/termos');
  $$
);
