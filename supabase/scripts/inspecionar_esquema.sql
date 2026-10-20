-- =====================================================================
-- INSPEÇÃO DO ESQUEMA REAL (somente leitura, não altera nada)
--
-- Rode no SQL Editor do Supabase ANTES de aplicar as migrations e salve
-- o resultado de cada consulta em docs/esquema-producao/ (ou mande para
-- quem for revisar). Serve para:
--   1. Conferir se as migrations batem com as tabelas reais;
--   2. Guardar um BACKUP das policies atuais (a consulta 4 gera o SQL
--      para recriá-las, caso seja preciso desfazer a migração).
-- =====================================================================

-- 1. Colunas das tabelas do app
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('profiles', 'appointments', 'services', 'products')
order by table_name, ordinal_position;

-- 2. Chaves e restrições (PK, FK, unique, check)
select tc.table_name, tc.constraint_name, tc.constraint_type,
       pg_get_constraintdef(c.oid) as definicao
from information_schema.table_constraints tc
join pg_constraint c on c.conname = tc.constraint_name
where tc.table_schema = 'public'
  and tc.table_name in ('profiles', 'appointments', 'services', 'products')
order by tc.table_name, tc.constraint_type;

-- 3. Triggers existentes (inclusive em auth.users, ex.: criação automática de perfil)
select event_object_schema as schema, event_object_table as tabela, trigger_name,
       action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema in ('public', 'auth')
order by 1, 2, 3;

-- 4. BACKUP das policies atuais em forma de SQL (guarde este resultado!)
select format(
         'create policy %I on %I.%I as %s for %s to %s%s%s;',
         policyname, schemaname, tablename, permissive, cmd,
         array_to_string(roles, ', '),
         case when qual is not null then ' using (' || qual || ')' else '' end,
         case when with_check is not null then ' with check (' || with_check || ')' else '' end
       ) as recriar_policy
from pg_policies
where schemaname = 'public'
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

-- 5. Tabelas com RLS ligada/desligada
select relname as tabela, relrowsecurity as rls_ligada
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;
