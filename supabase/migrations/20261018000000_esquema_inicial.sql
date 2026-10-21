-- =====================================================================
-- ESQUEMA INICIAL (tabelas do app e bucket de fotos)
--
-- Cria do zero tudo o que o app usa. Escrito a partir do código, porque
-- o projeto original do Supabase foi perdido. As regras de segurança
-- (RLS, triggers e funções) vêm nas migrations seguintes.
--
-- Pode ser rodado mais de uma vez sem quebrar nada.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PROFILES: dados do cliente/barbeiro (1 para 1 com auth.users)
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  email text, -- copiado de auth.users pelo trigger abaixo (tela Clientes do admin)
  avatar_url text,
  role text not null default 'client' check (role in ('client', 'admin')),
  loyalty_points integer not null default 0 check (loyalty_points >= 0),
  push_token text,
  updated_at timestamptz default now()
);

-- O e-mail vem sempre do login, nunca do que o app envia
create or replace function public.sync_profile_email()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  select email into new.email from auth.users where id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_profile_email on public.profiles;
create trigger sync_profile_email
  before insert or update on public.profiles
  for each row execute function public.sync_profile_email();

revoke execute on function public.sync_profile_email from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. APPOINTMENTS: agendamentos e bloqueios de agenda
--    status: pending (pedido) -> confirmed / declined -> completed
--            cancelled (cliente desistiu) | blocked (bloqueio do admin)
-- ---------------------------------------------------------------------

create table if not exists public.appointments (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null, -- vazio = cliente excluído
  client_name text,
  service_names text, -- "Corte + Barba"
  date date not null,
  time time not null,
  duration integer not null default 30 check (duration > 0),
  price numeric(10, 2) not null default 0 check (price >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'declined', 'cancelled', 'completed', 'blocked')),
  payment_method text,
  created_at timestamptz not null default now()
);

create index if not exists appointments_date_idx on public.appointments (date);
create index if not exists appointments_user_id_idx on public.appointments (user_id);


-- ---------------------------------------------------------------------
-- 3. SERVICES e PRODUCTS: catálogo mantido pelo barbeiro
-- ---------------------------------------------------------------------

create table if not exists public.services (
  id bigint generated always as identity primary key,
  title text not null,
  price numeric(10, 2) not null check (price >= 0),
  duration integer not null default 30 check (duration > 0),
  points integer not null default 10 check (points >= 0),
  icon text default 'content-cut',
  category text
);

create table if not exists public.products (
  id bigint generated always as identity primary key,
  title text not null,
  category text,
  price numeric(10, 2) not null check (price >= 0),
  img text,
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now()
);


-- RLS ligada desde o início; as policies vêm em 20261019000000_seguranca
alter table public.profiles     enable row level security;
alter table public.appointments enable row level security;
alter table public.services     enable row level security;
alter table public.products     enable row level security;


-- ---------------------------------------------------------------------
-- 4. STORAGE: fotos dos produtos (leitura pública pela URL)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produtos', 'produtos', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;
