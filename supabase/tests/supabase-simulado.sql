-- =====================================================================
-- SUPABASE SIMULADO para os testes (npm run test:db)
--
-- Recria só o que o Supabase já fornece num projeto novo (roles,
-- auth.uid(), auth.jwt(), auth.users e storage). As tabelas do app vêm
-- das migrations, exatamente como no projeto real.
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
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id bigint generated always as identity primary key, bucket_id text references storage.buckets (id), name text);
alter table storage.objects enable row level security;

grant usage on schema auth, storage, public to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to authenticated, service_role;

-- Permissões padrão do Supabase para as tabelas do schema public
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
