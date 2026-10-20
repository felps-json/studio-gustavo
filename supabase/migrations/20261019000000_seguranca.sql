-- =====================================================================
-- SEGURANÇA DO BANCO (RLS, papéis, pontos, conflito de horários)
--
-- ANTES DE RODAR:
--   1. Faça um backup (Dashboard > Database > Backups).
--   2. Este script APAGA todas as policies atuais de profiles, appointments,
--      services, products e as do bucket 'produtos', e cria novas.
--   3. Teste primeiro num projeto de homologação, se possível.
--   4. Para desfazer: supabase/scripts/rollback_seguranca.sql
--
-- CÓDIGOS DE ERRO (usados pelo app em src/constants/errors.js):
--   GS001 = horário ocupado | GS002 = fora do prazo de cancelamento
--   GS003 = operação não permitida
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. VERIFICAÇÃO PRÉVIA: aborta antes de alterar qualquer coisa se o
--    esquema real for diferente do que este script espera
-- ---------------------------------------------------------------------

do $$
declare v_missing text;
begin
  select string_agg(v.t || '.' || v.c, ', ') into v_missing
  from (values
    ('profiles', 'id'), ('profiles', 'role'), ('profiles', 'loyalty_points'), ('profiles', 'full_name'),
    ('appointments', 'id'), ('appointments', 'user_id'), ('appointments', 'client_name'),
    ('appointments', 'service_names'), ('appointments', 'date'), ('appointments', 'time'),
    ('appointments', 'duration'), ('appointments', 'status'),
    ('services', 'title'), ('services', 'points'),
    ('products', 'id')
  ) as v(t, c)
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = v.t and column_name = v.c
  );

  if v_missing is not null then
    raise exception 'Esquema diferente do esperado. Colunas ausentes: %', v_missing;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 0.1 CONFIGURAÇÕES DA BARBEARIA (fonte única para app e banco)
-- ---------------------------------------------------------------------

create table if not exists public.business_settings (
  id integer primary key default 1 check (id = 1), -- tabela de uma linha só
  cancellation_min_hours integer not null default 2,
  opening_hour integer not null default 9,
  closing_hour integer not null default 19,
  slot_interval integer not null default 30,
  work_on_sunday boolean not null default false,
  work_on_monday boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.business_settings (id) values (1) on conflict (id) do nothing;


-- ---------------------------------------------------------------------
-- 1. FUNÇÕES AUXILIARES
-- ---------------------------------------------------------------------

-- Usuário logado é o barbeiro?
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Admin OU servidor (Edge Functions com service_role, SQL Editor).
-- Usa o papel do token, que não muda dentro de funções security definer.
create or replace function public.is_privileged()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'role', '') not in ('authenticated', 'anon')
         or public.is_admin();
$$;


-- ---------------------------------------------------------------------
-- 2. PROFILES: cliente não pode mudar o próprio papel nem os pontos
-- ---------------------------------------------------------------------

create or replace function public.protect_profile_fields()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.is_privileged() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'client';
    new.loyalty_points := 0;
  else
    new.role := old.role;
    new.loyalty_points := old.loyalty_points;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
  before insert or update on public.profiles
  for each row execute function public.protect_profile_fields();


-- ---------------------------------------------------------------------
-- 3. APPOINTMENTS: regras de agendamento, cancelamento e conflito
-- ---------------------------------------------------------------------

create or replace function public.validate_appointment()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_start timestamp;
  v_end timestamp;
begin
  if not public.is_privileged() then
    if tg_op = 'INSERT' then
      -- Cliente só agenda para si mesmo e sempre como "pendente"
      if new.user_id is distinct from auth.uid() then
        raise exception 'Agendamento inválido.' using errcode = 'GS003';
      end if;
      new.status := 'pending';
      select full_name into new.client_name from public.profiles where id = auth.uid();
    else
      -- Cliente só pode CANCELAR o próprio horário, e nada mais
      if new.status <> 'cancelled'
         or old.status not in ('pending', 'confirmed')
         or (to_jsonb(new) - 'status' - 'updated_at') <> (to_jsonb(old) - 'status' - 'updated_at') then
        raise exception 'Alteração não permitida.' using errcode = 'GS003';
      end if;

      if (old.date::date + old.time::time) < (now() at time zone 'America/Sao_Paulo')
           + make_interval(hours => (select cancellation_min_hours from public.business_settings where id = 1)) then
        raise exception 'Fora do prazo de cancelamento.' using errcode = 'GS002';
      end if;

      return new;
    end if;
  end if;

  -- Impede dois agendamentos no mesmo horário (vale também para o admin)
  if new.status in ('pending', 'confirmed', 'blocked')
     and (tg_op = 'INSERT'
          or new.date is distinct from old.date
          or new.time is distinct from old.time
          or new.duration is distinct from old.duration
          or old.status not in ('pending', 'confirmed', 'blocked')) then

    -- Trava o dia para evitar corrida entre dois clientes simultâneos
    perform pg_advisory_xact_lock(hashtext('appointments:' || new.date::date::text));

    v_start := new.date::date + new.time::time;
    v_end := v_start + make_interval(mins => coalesce(new.duration, 30));

    if exists (
      select 1 from public.appointments a
      where a.id is distinct from new.id
        and a.date::date = new.date::date
        and a.status in ('pending', 'confirmed', 'blocked')
        and (a.date::date + a.time::time) < v_end
        and v_start < (a.date::date + a.time::time) + make_interval(mins => coalesce(a.duration, 30))
    ) then
      raise exception 'Horário ocupado.' using errcode = 'GS001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_appointment on public.appointments;
create trigger validate_appointment
  before insert or update on public.appointments
  for each row execute function public.validate_appointment();


-- Horários ocupados, sem expor nome/preço dos outros clientes
create or replace function public.get_busy_slots(p_start date, p_end date)
returns table (date date, "time" time, duration integer)
language sql stable security definer set search_path = public
as $$
  select a.date::date, a.time::time, coalesce(a.duration, 30)::integer
  from public.appointments a
  where a.date::date between p_start and p_end
    and a.status in ('pending', 'confirmed', 'blocked');
$$;


-- Finaliza o atendimento e soma os pontos numa única transação
create or replace function public.complete_appointment(p_id public.appointments.id%type)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_appt public.appointments;
  v_points integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Apenas o administrador pode finalizar atendimentos.' using errcode = 'GS003';
  end if;

  select * into v_appt from public.appointments where id = p_id for update;
  if not found then
    raise exception 'Agendamento não encontrado.' using errcode = 'GS003';
  end if;
  if v_appt.status = 'completed' then
    return 0; -- já finalizado: não pontua duas vezes
  end if;

  update public.appointments set status = 'completed' where id = p_id;

  if v_appt.user_id is not null then
    -- "Corte + Barba" => soma os pontos de cada serviço pelo nome
    select coalesce(sum(coalesce(s.points, 0)), 0)::integer into v_points
    from unnest(string_to_array(coalesce(v_appt.service_names, ''), '+')) as n(name)
    join lateral (
      select points from public.services
      where lower(trim(title)) = lower(trim(n.name))
      limit 1
    ) s on true;

    if v_points > 0 then
      update public.profiles
      set loyalty_points = coalesce(loyalty_points, 0) + v_points
      where id = v_appt.user_id;
    end if;
  end if;

  return v_points;
end;
$$;


-- Só usuários logados podem chamar as funções
revoke execute on function public.is_admin, public.is_privileged,
  public.get_busy_slots, public.complete_appointment from public, anon;
grant execute on function public.is_admin, public.is_privileged,
  public.get_busy_slots, public.complete_appointment to authenticated;


-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (quem lê e escreve o quê)
-- ---------------------------------------------------------------------

-- Remove as policies antigas (podem ter brechas que somariam às novas)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'appointments', 'services', 'products')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.profiles     enable row level security;
alter table public.appointments enable row level security;
alter table public.services     enable row level security;
alter table public.products     enable row level security;
alter table public.business_settings enable row level security;

-- BUSINESS_SETTINGS: todos leem; só admin altera
drop policy if exists business_settings_select on public.business_settings;
drop policy if exists business_settings_update on public.business_settings;
create policy business_settings_select on public.business_settings for select to authenticated using (true);
create policy business_settings_update on public.business_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- PROFILES: cada um vê/edita o seu; admin vê/edita todos
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- APPOINTMENTS: cliente só os próprios; admin todos; só admin apaga
create policy appointments_select on public.appointments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy appointments_insert on public.appointments for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());
create policy appointments_update on public.appointments for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy appointments_delete on public.appointments for delete to authenticated
  using (public.is_admin());

-- SERVICES e PRODUCTS: todos leem; só admin altera
create policy services_select on public.services for select to authenticated using (true);
create policy services_write  on public.services for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy products_select on public.products for select to authenticated using (true);
create policy products_write  on public.products for all    to authenticated
  using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 5. STORAGE: só o admin envia/altera fotos de produtos
--    (a leitura continua pública pela URL do bucket)
-- ---------------------------------------------------------------------

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%produtos%' or coalesce(with_check, '') ilike '%produtos%')
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy produtos_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'produtos' and public.is_admin());
create policy produtos_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'produtos' and public.is_admin());
create policy produtos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'produtos' and public.is_admin());
