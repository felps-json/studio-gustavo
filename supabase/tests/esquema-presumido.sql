-- =====================================================================
-- ESQUEMA PRESUMIDO para os testes (npm run test:db)
--
-- Simula o que o Supabase já fornece (roles, auth.uid(), auth.jwt(),
-- storage.objects) e as tabelas do app, deduzidas a partir do código.
-- Quando o esquema real for exportado (veja docs/DEPLOY.md), substitua a
-- parte "TABELAS DO APP" por ele para que os testes reflitam a produção.
-- =====================================================================

-- --- Simulação do Supabase -------------------------------------------
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key, email text);

create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                  nullif(current_setting('request.jwt.claims', true), ''))::jsonb;
$$;

create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create schema storage;
create table storage.objects (id bigint generated always as identity primary key, bucket_id text, name text);
alter table storage.objects enable row level security;

grant usage on schema auth, storage, public to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant all on storage.objects to authenticated, service_role;

-- --- TABELAS DO APP (presumidas) ---------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  role text default 'client',
  loyalty_points integer default 0,
  push_token text,
  updated_at timestamptz
);

create table public.appointments (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id),
  client_name text,
  service_names text,
  date date,
  time time,
  duration integer,
  price numeric,
  status text,
  payment_method text,
  created_at timestamptz default now()
);

create table public.services (
  id bigint generated always as identity primary key,
  title text, price numeric, duration integer, points integer, icon text, category text
);

create table public.products (
  id bigint generated always as identity primary key,
  title text, category text, price numeric, img text, stock integer,
  created_at timestamptz default now()
);

-- Permissões padrão do Supabase para as tabelas do schema public
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
