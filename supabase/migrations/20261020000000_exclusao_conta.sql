-- =====================================================================
-- EXCLUSÃO DE CONTA ATÔMICA + AUDITORIA
--
-- Antes, a Edge Function delete-account fazia vários passos separados:
-- uma falha no meio deixava os dados pela metade, e se a anonimização
-- falhasse ela apagava o histórico sem avisar. Agora tudo roda numa
-- única transação e cada exclusão fica registrada.
--
-- Política de retenção (VALIDAR COM O GUSTAVO / JURÍDICO):
--   agendamentos futuros => apagados
--   agendamentos passados => anonimizados (mantém o faturamento)
-- =====================================================================

-- Necessário para anonimizar o histórico (user_id vazio)
alter table public.appointments alter column user_id drop not null;

-- Registro de auditoria (sem dados pessoais além do id técnico)
create table if not exists public.account_deletions (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  deleted_at timestamptz not null default now(),
  future_appointments_deleted integer not null,
  past_appointments_anonymized integer not null
);

-- RLS ligada e sem policies: só o servidor (service_role) acessa
alter table public.account_deletions enable row level security;

create or replace function public.delete_account_data(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_future integer;
  v_past integer;
begin
  if exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then
    raise exception 'Conta de administrador não pode ser excluída pelo app.' using errcode = 'GS003';
  end if;

  delete from public.appointments
  where user_id = p_user_id
    and date::date >= (now() at time zone 'America/Sao_Paulo')::date;
  get diagnostics v_future = row_count;

  update public.appointments
  set user_id = null, client_name = 'Cliente excluído'
  where user_id = p_user_id;
  get diagnostics v_past = row_count;

  delete from public.profiles where id = p_user_id;

  insert into public.account_deletions (user_id, future_appointments_deleted, past_appointments_anonymized)
  values (p_user_id, v_future, v_past);
end;
$$;

-- Só a Edge Function (service_role) pode chamar
revoke execute on function public.delete_account_data from public, anon, authenticated;
grant execute on function public.delete_account_data to service_role;
