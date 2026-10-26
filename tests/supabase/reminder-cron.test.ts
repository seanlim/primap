// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

let db: PGlite
beforeAll(async () => {
  db = new PGlite()
  // Stub the platform extensions; execute the real scheduling SQL against Postgres.
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE app_settings (reminder_send_time time, reminder_send_weekday int);
    INSERT INTO app_settings VALUES ('13:00', 3);
    CREATE TABLE walk_slots (id uuid PRIMARY KEY, walk_date date);
    CREATE TABLE profiles (id uuid PRIMARY KEY);
    CREATE TABLE observations (slot_id uuid, status text);
    CREATE SCHEMA vault;
    CREATE TABLE vault.decrypted_secrets (name text, decrypted_secret text);
    INSERT INTO vault.decrypted_secrets VALUES ('primap_app_url', 'https://example.test'), ('primap_cron_secret', 'test-secret');
    CREATE SCHEMA net;
    CREATE TABLE net.requests (url text, headers jsonb);
    CREATE FUNCTION net.http_get(url text, headers jsonb, timeout_milliseconds int) RETURNS bigint LANGUAGE plpgsql AS $$
      BEGIN INSERT INTO net.requests VALUES (url, headers); RETURN 1; END;
    $$;
    CREATE SCHEMA cron;
    CREATE TABLE cron.job (jobname text, schedule text, command text);
    CREATE FUNCTION cron.schedule(jobname text, schedule text, command text) RETURNS bigint LANGUAGE plpgsql AS $$
      BEGIN INSERT INTO cron.job VALUES (jobname, schedule, command); RETURN 1; END;
    $$;
  `)
  const migration = readFileSync('supabase/migrations/20261026090000_schedule_report_reminders.sql', 'utf8')
    .replace(/^create extension.*;$/gmi, '')
  await db.exec(migration)
}, 30_000)
afterAll(async () => db?.close())
beforeEach(async () => {
  await db.exec(`TRUNCATE net.requests, observations, walk_slots, report_reminder_deliveries, profiles;
    UPDATE app_settings SET reminder_send_time = '13:00', reminder_send_weekday = 3;
    DELETE FROM vault.decrypted_secrets;
    INSERT INTO vault.decrypted_secrets VALUES ('primap_app_url', 'https://example.test'), ('primap_cron_secret', 'test-secret');`)
})
async function dispatch(now: string) {
  await db.query('SELECT public.dispatch_reminder_batches($1::timestamptz)', [now])
  return (await db.query<{ url: string; headers: Record<string, string> }>('SELECT * FROM net.requests')).rows
}
it('registers an hourly check on minute 00', async () => {
  expect((await db.query('SELECT schedule, command FROM cron.job')).rows).toEqual([
    { schedule: '0 * * * *', command: 'select public.dispatch_reminder_batches();' },
  ])
})
it('makes no HTTP requests outside the admin send hour', async () => {
  expect(await dispatch('2026-10-28T04:00:00Z')).toEqual([])
  expect(await dispatch('2026-10-28T06:00:00Z')).toEqual([])
})
it('calls the upcoming-walk endpoint only on the configured Singapore weekday and hour', async () => {
  expect(await dispatch('2026-10-27T05:00:00Z')).toEqual([])
  expect(await dispatch('2026-10-28T05:00:00Z')).toEqual([
    { url: 'https://example.test/api/cron/reminders', headers: { Authorization: 'Bearer test-secret' } },
  ])
})
it('calls report reminders on a different weekday for missing or draft reports at day 3 or 7', async () => {
  await db.exec(`INSERT INTO walk_slots VALUES
    ('11111111-1111-4111-8111-111111111111', '2026-10-24'),
    ('22222222-2222-4222-8222-222222222222', '2026-10-20');
    INSERT INTO observations VALUES ('22222222-2222-4222-8222-222222222222', 'DRAFT');`)
  expect(await dispatch('2026-10-27T05:00:00Z')).toEqual([
    { url: 'https://example.test/api/cron/report-reminders', headers: { Authorization: 'Bearer test-secret' } },
  ])
})
it('does not call report reminders for submitted reports or other elapsed days', async () => {
  await db.exec(`INSERT INTO walk_slots VALUES
    ('11111111-1111-4111-8111-111111111111', '2026-10-24'),
    ('22222222-2222-4222-8222-222222222222', '2026-10-23');
    INSERT INTO observations VALUES ('11111111-1111-4111-8111-111111111111', 'SUBMITTED');`)
  expect(await dispatch('2026-10-27T05:00:00Z')).toEqual([])
})
it('uses changed settings immediately, including midnight in Singapore', async () => {
  await db.exec("UPDATE app_settings SET reminder_send_time = '00:00', reminder_send_weekday = 1")
  expect((await dispatch('2026-10-25T16:00:00Z')).map(r => r.url)).toEqual(['https://example.test/api/cron/reminders'])
})
it('still sends when the hourly job starts two minutes late', async () => {
  expect((await dispatch('2026-10-28T05:02:00Z')).map(r => r.url)).toEqual(['https://example.test/api/cron/reminders'])
})
it('calls both endpoints at the configured hour when both batches are due', async () => {
  await db.exec("INSERT INTO walk_slots VALUES ('11111111-1111-4111-8111-111111111111', '2026-10-25')")
  expect((await dispatch('2026-10-28T05:00:00Z')).map(r => r.url)).toEqual([
    'https://example.test/api/cron/reminders', 'https://example.test/api/cron/report-reminders',
  ])
})
it('does not call either endpoint without its Vault secret', async () => {
  await db.exec("DELETE FROM vault.decrypted_secrets WHERE name = 'primap_cron_secret'")
  expect(await dispatch('2026-10-28T05:00:00Z')).toEqual([])
})
it('keeps delivery records unique per participant, walk and reminder day', async () => {
  await db.exec(`INSERT INTO walk_slots VALUES ('11111111-1111-4111-8111-111111111111', '2026-10-24');
    INSERT INTO profiles VALUES ('22222222-2222-4222-8222-222222222222');`)
  const insert = `INSERT INTO report_reminder_deliveries(slot_id, user_id, reminder_day) VALUES
    ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 3)`
  await db.exec(insert)
  await expect(db.exec(insert)).rejects.toThrow('duplicate key')
  await expect(db.exec(insert.replace(', 3)', ', 7)'))).resolves.toBeDefined()
  await expect(db.exec(insert.replace(', 3)', ', 5)'))).rejects.toThrow('check constraint')
})
it('denies public access to delivery records and the secret-reading dispatcher', async () => {
  await db.exec('SET ROLE authenticated')
  try {
    await expect(db.query('SELECT * FROM report_reminder_deliveries')).rejects.toThrow('permission denied')
    await expect(db.query('SELECT public.dispatch_reminder_batches()')).rejects.toThrow('permission denied')
  } finally { await db.exec('RESET ROLE') }
})
it('rejects a direct settings update that sets nonzero minutes', async () => {
  await expect(db.exec("UPDATE app_settings SET reminder_send_time = '13:30'")).rejects.toThrow('check constraint')
})
