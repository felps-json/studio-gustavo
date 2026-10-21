// Garante que as migrations podem ser desfeitas e reaplicadas, e que o
// script de inspeção roda sem erro. Parte de: npm run test:db
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const files = readdirSync(new URL('../migrations/', import.meta.url))
  .filter((f) => f.endsWith('.sql'))
  .sort();
const migrations = files.map((f) => read(`../migrations/${f}`));
const migration = (name) => read(`../migrations/${files.find((f) => f.includes(name))}`);

const countObjects = async (db) => {
  const { rows: [r] } = await db.query(`
    select
      (select count(*) from pg_policies where policyname like any (array['profiles_%', 'appointments_%', 'services_%', 'products_%', 'produtos_admin_%']))::int as policies,
      (select count(*) from pg_proc where proname in ('is_admin', 'is_privileged', 'get_busy_slots', 'complete_appointment', 'delete_account_data'))::int as funcoes,
      (select count(*) from pg_tables where tablename in ('business_settings', 'account_deletions'))::int as tabelas`);
  return r;
};

test('migrations são desfeitas pelo rollback e podem ser reaplicadas', async () => {
  const db = new PGlite();
  await db.exec(read('supabase-simulado.sql'));
  for (const sql of migrations) await db.exec(sql);

  const aplicado = await countObjects(db);
  assert.ok(aplicado.policies > 0 && aplicado.funcoes === 5 && aplicado.tabelas === 2);

  await db.exec(read('../scripts/rollback_seguranca.sql'));
  assert.deepEqual(await countObjects(db), { policies: 0, funcoes: 0, tabelas: 0 });

  for (const sql of migrations) await db.exec(sql);
  assert.deepEqual(await countObjects(db), aplicado);

  // Rodar de novo por cima (ex.: alguém executa o script duas vezes) também não pode quebrar
  for (const sql of migrations) await db.exec(sql);
  assert.deepEqual(await countObjects(db), aplicado);
});

test('migration aborta sem alterar nada se o esquema real for diferente', async () => {
  const db = new PGlite();
  await db.exec(read('supabase-simulado.sql'));
  await db.exec(migration('esquema_inicial'));
  await db.exec('alter table public.services rename column points to pontos');

  await assert.rejects(db.exec(migration('seguranca')), /Colunas ausentes: services.points/);
  assert.deepEqual(await countObjects(db), { policies: 0, funcoes: 0, tabelas: 0 });
});

test('script de inspeção do esquema roda sem erro', async () => {
  const db = new PGlite();
  await db.exec(read('supabase-simulado.sql'));
  for (const sql of migrations) await db.exec(sql);
  await db.exec(read('../scripts/inspecionar_esquema.sql'));
});
