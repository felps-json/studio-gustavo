-- =====================================================================
-- ROLLBACK das migrations 20261019000000_seguranca e
-- 20261020000000_exclusao_conta
--
-- Remove tudo o que elas criaram. ATENÇÃO:
--   * As policies ANTIGAS não voltam sozinhas: depois deste script, rode
--     o SQL salvo pela consulta 4 de supabase/scripts/inspecionar_esquema.sql.
--   * Até recriar as policies antigas, as tabelas ficam com RLS ligada e
--     sem policies, ou seja, o app fica SEM acesso aos dados.
--   * appointments.user_id continua aceitando NULL (agendamentos já
--     anonimizados impedem voltar ao NOT NULL).
-- =====================================================================

-- Exclusão de conta
drop function if exists public.delete_account_data(uuid);
drop table if exists public.account_deletions;

-- Triggers
drop trigger if exists protect_profile_fields on public.profiles;
drop trigger if exists validate_appointment on public.appointments;

-- Policies novas
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists appointments_select on public.appointments;
drop policy if exists appointments_insert on public.appointments;
drop policy if exists appointments_update on public.appointments;
drop policy if exists appointments_delete on public.appointments;
drop policy if exists services_select on public.services;
drop policy if exists services_write on public.services;
drop policy if exists products_select on public.products;
drop policy if exists products_write on public.products;
drop policy if exists produtos_admin_insert on storage.objects;
drop policy if exists produtos_admin_update on storage.objects;
drop policy if exists produtos_admin_delete on storage.objects;

-- Configurações (suas policies usam is_admin, então saem antes das funções)
drop table if exists public.business_settings;

-- Funções (complete_appointment usa o tipo de appointments.id)
drop function if exists public.complete_appointment;
drop function if exists public.get_busy_slots(date, date);
drop function if exists public.validate_appointment();
drop function if exists public.protect_profile_fields();
drop function if exists public.is_privileged();
drop function if exists public.is_admin();

-- Agora rode o backup das policies antigas.
