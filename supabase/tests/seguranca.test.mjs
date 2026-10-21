// Testes das regras de segurança do banco (RLS, triggers e funções).
// Roda as migrations num PostgreSQL embutido (PGlite), sem Docker:
//   npm run test:db
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const dir = new URL('.', import.meta.url);
const migrationsDir = new URL('../migrations/', import.meta.url);

const ADMIN = '00000000-0000-0000-0000-00000000000a';
const CLIENTE1 = '00000000-0000-0000-0000-00000000000b';
const CLIENTE2 = '00000000-0000-0000-0000-00000000000c';

let db;
let amanha;
let ontem;

// Executa SQL como um usuário logado (mesmo papel e token que o app usa)
const as = (uid, sql, params = []) =>
  db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);
    await tx.exec('set local role authenticated');
    return tx.query(sql, params);
  });

// Executa SQL como a Edge Function (service_role)
const asService = (sql, params = []) =>
  db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'service_role' })]);
    await tx.exec('set local role service_role');
    return tx.query(sql, params);
  });

const rejectsWith = (promise, code) => assert.rejects(promise, (e) => e.code === code || assert.fail(`esperava ${code}, veio ${e.code}: ${e.message}`));

const agendar = (uid, date, time, duration = 30) =>
  as(uid,
    `insert into appointments (user_id, client_name, service_names, date, time, duration, price, status, payment_method)
     values ($1, 'Nome Falso', 'Corte + Barba', $2, $3, $4, 80, 'confirmed', 'local') returning *`,
    [uid, date, time, duration]);

before(async () => {
  db = new PGlite();
  await db.exec(readFileSync(new URL('supabase-simulado.sql', dir), 'utf8'));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(file, migrationsDir), 'utf8'));
  }

  await db.exec(`
    insert into auth.users (id, email) values
      ('${ADMIN}', 'admin@teste.com'), ('${CLIENTE1}', 'c1@teste.com'), ('${CLIENTE2}', 'c2@teste.com');
    insert into profiles (id, full_name, phone, role, loyalty_points) values
      ('${ADMIN}', 'Gustavo', '1', 'admin', 0),
      ('${CLIENTE1}', 'Cliente Um', '2', 'client', 0),
      ('${CLIENTE2}', 'Cliente Dois', '3', 'client', 0);
    insert into services (title, price, duration, points) values ('Corte', 50, 30, 10), ('Barba', 30, 30, 5);
  `);

  const { rows } = await db.query(`
    select ((now() at time zone 'America/Sao_Paulo')::date + 1)::text as amanha,
           ((now() at time zone 'America/Sao_Paulo')::date - 1)::text as ontem`);
  ({ amanha, ontem } = rows[0]);

  // Agendamento do cliente 2 amanhã às 10:00 (1h)
  await db.query(`insert into appointments (user_id, client_name, service_names, date, time, duration, price, status)
                  values ($1, 'Cliente Dois', 'Corte', $2, '10:00', 60, 50, 'confirmed')`, [CLIENTE2, amanha]);
});

// --- PROFILES ----------------------------------------------------------

test('cliente não consegue virar admin nem alterar os próprios pontos', async () => {
  await as(CLIENTE1, `update profiles set role = 'admin', loyalty_points = 999, full_name = 'Novo Nome' where id = $1`, [CLIENTE1]);
  const { rows } = await db.query('select role, loyalty_points, full_name from profiles where id = $1', [CLIENTE1]);
  assert.deepEqual(rows[0], { role: 'client', loyalty_points: 0, full_name: 'Novo Nome' });
});

test('cliente novo é sempre criado como client com 0 pontos', async () => {
  const novo = '00000000-0000-0000-0000-00000000000d';
  await db.query(`insert into auth.users (id) values ($1)`, [novo]);
  await as(novo, `insert into profiles (id, full_name, phone, role, loyalty_points) values ($1, 'X', '9', 'admin', 500)`, [novo]);
  const { rows } = await db.query('select role, loyalty_points from profiles where id = $1', [novo]);
  assert.deepEqual(rows[0], { role: 'client', loyalty_points: 0 });
});

test('e-mail do perfil vem sempre do login, não do app', async () => {
  await as(CLIENTE1, `update profiles set email = 'falso@x.com' where id = $1`, [CLIENTE1]);
  const { rows } = await db.query('select email from profiles where id = $1', [CLIENTE1]);
  assert.equal(rows[0].email, 'c1@teste.com');
});

test('cliente não vê o perfil de outro cliente', async () => {
  const { rows } = await as(CLIENTE1, 'select id from profiles');
  assert.deepEqual(rows.map((r) => r.id), [CLIENTE1]);
});

// --- APPOINTMENTS ------------------------------------------------------

test('cliente não vê agendamentos de outros clientes', async () => {
  const { rows } = await as(CLIENTE1, 'select * from appointments where user_id = $1', [CLIENTE2]);
  assert.equal(rows.length, 0);
});

test('get_busy_slots mostra o horário ocupado sem expor dados do cliente', async () => {
  const { rows } = await as(CLIENTE1, 'select * from get_busy_slots($1, $1)', [amanha]);
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['date', 'duration', 'time']);
});

test('cliente não consegue agendar em nome de outro', async () => {
  await rejectsWith(as(CLIENTE1,
    `insert into appointments (user_id, date, time, duration, status) values ($1, $2, '16:00', 30, 'pending')`, [CLIENTE2, amanha]), 'GS003');
});

test('agendamento do cliente entra como pendente e com o nome do perfil', async () => {
  const { rows } = await agendar(CLIENTE1, amanha, '14:00');
  assert.equal(rows[0].status, 'pending');
  assert.equal(rows[0].client_name, 'Novo Nome');
});

test('não permite dois agendamentos sobrepostos', async () => {
  // Existente: 10:00–11:00. Novo: 10:30–11:00 => conflito
  await rejectsWith(agendar(CLIENTE1, amanha, '10:30'), 'GS001');
  // 11:00 encosta mas não sobrepõe => permitido
  await agendar(CLIENTE1, amanha, '11:00');
});

test('agendamento recusado libera o horário', async () => {
  await as(ADMIN, `update appointments set status = 'declined' where user_id = $1 and date = $2 and time = '10:00'`, [CLIENTE2, amanha]);
  await agendar(CLIENTE1, amanha, '10:00');
});

test('cliente cancela com antecedência, mas não fora do prazo', async () => {
  const { rows: [futuro] } = await as(CLIENTE1, `select id from appointments where user_id = $1 and time = '11:00'`, [CLIENTE1]);
  await as(CLIENTE1, `update appointments set status = 'cancelled' where id = $1`, [futuro.id]);

  // Agendamento daqui a 1 hora (criado pelo admin)
  const { rows: [proximo] } = await db.query(`
    insert into appointments (user_id, client_name, date, time, duration, status)
    select $1, 'Cliente Um', (t)::date, (t)::time, 30, 'confirmed'
    from (select (now() at time zone 'America/Sao_Paulo') + interval '1 hour' as t) x
    returning id`, [CLIENTE1]);
  await rejectsWith(as(CLIENTE1, `update appointments set status = 'cancelled' where id = $1`, [proximo.id]), 'GS002');
});

test('cliente não consegue alterar outros campos do agendamento', async () => {
  const { rows: [appt] } = await as(CLIENTE1, `select id from appointments where user_id = $1 and time = '14:00'`, [CLIENTE1]);
  await rejectsWith(as(CLIENTE1, `update appointments set status = 'cancelled', price = 0 where id = $1`, [appt.id]), 'GS003');
  await rejectsWith(as(CLIENTE1, `update appointments set status = 'confirmed' where id = $1`, [appt.id]), 'GS003');
});

test('o prazo de cancelamento vem da tabela business_settings', async () => {
  // Cliente não altera configurações
  const { affectedRows } = await as(CLIENTE1, 'update business_settings set cancellation_min_hours = 0');
  assert.equal(affectedRows, 0);

  // Admin reduz o prazo para 0h: o cancelamento de daqui a 1h passa a ser aceito
  await as(ADMIN, 'update business_settings set cancellation_min_hours = 0');
  const { rows: [proximo] } = await db.query(`select id from appointments where user_id = $1 and status = 'confirmed' order by id desc limit 1`, [CLIENTE1]);
  await as(CLIENTE1, `update appointments set status = 'cancelled' where id = $1`, [proximo.id]);
  await db.query('update business_settings set cancellation_min_hours = 2');
});

test('banco recusa status desconhecido', async () => {
  await rejectsWith(db.query(`insert into appointments (user_id, date, time, status) values ($1, $2, '18:00', 'talvez')`, [CLIENTE1, amanha]), '23514');
});

// --- PONTOS DE FIDELIDADE ----------------------------------------------

test('só o admin finaliza atendimento, e os pontos são somados uma única vez', async () => {
  const { rows: [appt] } = await db.query(`select id from appointments where user_id = $1 and time = '14:00'`, [CLIENTE1]);

  await rejectsWith(as(CLIENTE1, 'select complete_appointment($1)', [appt.id]), 'GS003');

  const { rows: [r1] } = await as(ADMIN, 'select complete_appointment($1) as pontos', [appt.id]);
  assert.equal(r1.pontos, 15); // Corte (10) + Barba (5)

  const { rows: [r2] } = await as(ADMIN, 'select complete_appointment($1) as pontos', [appt.id]);
  assert.equal(r2.pontos, 0);

  const { rows: [p] } = await db.query('select loyalty_points from profiles where id = $1', [CLIENTE1]);
  assert.equal(p.loyalty_points, 15);
});

// --- SERVIÇOS, PRODUTOS E FOTOS -----------------------------------------

test('cliente lê serviços mas não altera', async () => {
  const { rows } = await as(CLIENTE1, 'select * from services');
  assert.equal(rows.length, 2);
  await rejectsWith(as(CLIENTE1, `insert into services (title, price, duration, points) values ('Hack', 1, 1, 1)`), '42501');
  await as(ADMIN, `insert into services (title, price, duration, points) values ('Pigmentação', 40, 30, 5)`);
});

test('bucket produtos é criado público e só aceita imagens', async () => {
  const { rows: [b] } = await db.query(`select public, allowed_mime_types from storage.buckets where id = 'produtos'`);
  assert.deepEqual(b, { public: true, allowed_mime_types: ['image/jpeg', 'image/png'] });
});

test('só o admin envia fotos para o bucket produtos', async () => {
  await rejectsWith(as(CLIENTE1, `insert into storage.objects (bucket_id, name) values ('produtos', 'x.jpg')`), '42501');
  await as(ADMIN, `insert into storage.objects (bucket_id, name) values ('produtos', 'y.jpg')`);
});

// --- EXCLUSÃO DE CONTA ---------------------------------------------------

test('cliente não chama delete_account_data diretamente', async () => {
  await rejectsWith(as(CLIENTE1, 'select delete_account_data($1)', [CLIENTE1]), '42501');
});

test('conta de admin não pode ser excluída', async () => {
  await rejectsWith(asService('select delete_account_data($1)', [ADMIN]), 'GS003');
});

test('exclusão apaga futuros, anonimiza passados, apaga o perfil e registra auditoria', async () => {
  await db.query(`insert into appointments (user_id, client_name, date, time, duration, price, status)
                  values ($1, 'Cliente Dois', $2, '09:00', 30, 50, 'completed')`, [CLIENTE2, ontem]);

  await asService('select delete_account_data($1)', [CLIENTE2]);

  const { rows: restantes } = await db.query('select client_name, date::text from appointments where user_id = $1', [CLIENTE2]);
  assert.equal(restantes.length, 0);

  const { rows: anonimos } = await db.query(`select * from appointments where user_id is null and date = $1`, [ontem]);
  assert.equal(anonimos.length, 1);
  assert.equal(anonimos[0].client_name, 'Cliente excluído');
  assert.equal(Number(anonimos[0].price), 50); // faturamento preservado

  const { rows: perfil } = await db.query('select * from profiles where id = $1', [CLIENTE2]);
  assert.equal(perfil.length, 0);

  const { rows: [audit] } = await db.query('select * from account_deletions where user_id = $1', [CLIENTE2]);
  assert.equal(audit.past_appointments_anonymized, 1);
  assert.ok(audit.future_appointments_deleted >= 1);
});
