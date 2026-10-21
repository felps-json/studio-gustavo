-- =====================================================================
-- NOTIFICAÇÕES E LEMBRETES (antes configurados à mão no painel)
--
--   * Novo pedido / pedido aceito ou recusado -> Edge Function push-notifications
--   * De hora em hora -> Edge Function cron-reminders (lembretes do dia)
--
-- ANTES DE RODAR, guarde a URL e a chave do projeto no Vault (SQL Editor):
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service_role key>', 'service_role_key');
-- Sem os segredos, nada quebra: as chamadas são puladas com um aviso.
--
-- NÃO crie também um "Database Webhook" no painel para appointments:
-- as notificações chegariam em dobro.
-- =====================================================================

-- Chama uma Edge Function sem travar a transação (pg_net é assíncrono)
create or replace function public.call_edge_function(p_name text, p_body jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';

  if v_url is null or v_key is null then
    raise warning 'Segredos project_url/service_role_key ausentes no Vault: % não foi chamada.', p_name;
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_name,
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key)
  );
end;
$$;

-- Mesmo formato de payload dos Database Webhooks do Supabase
create or replace function public.notify_appointment_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.call_edge_function('push-notifications', jsonb_build_object(
    'type', tg_op,
    'table', tg_table_name,
    'schema', tg_table_schema,
    'record', to_jsonb(new),
    'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) end
  ));
  return null;
end;
$$;

revoke execute on function public.call_edge_function, public.notify_appointment_change
  from public, anon, authenticated;


-- Triggers e agendamento só onde as extensões existem (no Supabase sim;
-- no PostgreSQL embutido dos testes, não)
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_net')
     or not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_net/pg_cron indisponíveis: notificações e lembretes não configurados.';
    return;
  end if;

  create extension if not exists pg_net with schema extensions;
  create extension if not exists pg_cron with schema pg_catalog;

  -- Só os eventos que viram notificação, para não chamar a função à toa
  drop trigger if exists notify_new_appointment on public.appointments;
  create trigger notify_new_appointment
    after insert on public.appointments
    for each row when (new.status <> 'blocked')
    execute function public.notify_appointment_change();

  drop trigger if exists notify_appointment_answer on public.appointments;
  create trigger notify_appointment_answer
    after update of status on public.appointments
    for each row when (old.status is distinct from new.status and new.status in ('confirmed', 'declined'))
    execute function public.notify_appointment_change();

  -- A função decide o que enviar pela hora atual (6h e "faltam 2 horas")
  perform cron.schedule('lembretes-agendamentos', '0 * * * *',
    $cron$ select public.call_edge_function('cron-reminders', '{}'::jsonb) $cron$);
end $$;
