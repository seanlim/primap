// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

let db: PGlite
const observation = '11111111-1111-4111-8111-111111111111'
const otherObservation = '22222222-2222-4222-8222-222222222222'
const first = '33333333-3333-4333-8333-333333333333'
const second = '44444444-4444-4444-8444-444444444444'
const other = '55555555-5555-4555-8555-555555555555'
const incident = '66666666-6666-4666-8666-666666666666'

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE TABLE app_settings (max_media_per_report int);
    INSERT INTO app_settings VALUES (10);
    CREATE TABLE sightings (id uuid PRIMARY KEY, observation_id uuid NOT NULL);
    CREATE TABLE media (id serial PRIMARY KEY, observation_id uuid, sighting_id uuid REFERENCES sightings(id), incident_id uuid);
    INSERT INTO sightings VALUES ('${first}', '${observation}'), ('${second}', '${observation}'), ('${other}', '${otherObservation}');
  `)
  const dir = resolve('supabase/migrations')
  const baseline = readFileSync(resolve(dir, '20260719052951_update_round_part_and_contact_ops.sql'), 'utf8')
  const trigger = baseline.match(/CREATE OR REPLACE FUNCTION public.enforce_max_media_per_report\(\)[\s\S]*?END \$function\$\s*;/)![0]
  await db.exec(trigger)
  await db.exec('CREATE TRIGGER enforce_max_media_per_report_trigger BEFORE INSERT ON media FOR EACH ROW EXECUTE FUNCTION enforce_max_media_per_report()')
  // Apply report-limit replacements after the deployed baseline, in migration order.
  for (const name of readdirSync(dir).filter(name => name.endsWith('_enforce_report_media_limit.sql')).sort()) {
    await db.exec(readFileSync(resolve(dir, name), 'utf8'))
  }
}, 30_000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec('TRUNCATE media; UPDATE app_settings SET max_media_per_report = 10')
})
async function add(column: 'observation_id' | 'sighting_id' | 'incident_id', id: string, count = 1) {
  for (let i = 0; i < count; i++) await db.query(`INSERT INTO media (${column}) VALUES ($1)`, [id])
}
it('counts two sightings against the same report cap', async () => {
  await add('sighting_id', first, 6)
  await add('sighting_id', second, 4)
  await expect(add('sighting_id', second)).rejects.toThrow('Maximum of 10 media files allowed per report')
  await expect(add('sighting_id', first)).rejects.toThrow('Maximum of 10 media files allowed per report')
  expect((await db.query('SELECT count(*)::int AS total FROM media')).rows).toEqual([{ total: 10 }])
})
it('combines observation and sighting media, preserving separate reports and incidents', async () => {
  await add('observation_id', observation, 6)
  await add('sighting_id', first, 4)
  await expect(add('sighting_id', second)).rejects.toThrow('Maximum of 10')
  await expect(add('observation_id', observation)).rejects.toThrow('Maximum of 10')
  await expect(add('sighting_id', other)).resolves.toBeUndefined()
  await expect(add('incident_id', incident, 10)).resolves.toBeUndefined()
  await expect(add('incident_id', incident)).rejects.toThrow('Maximum of 10')
})
it('uses the configured limit and frees a place after deletion', async () => {
  await db.exec('UPDATE app_settings SET max_media_per_report = 2')
  await add('sighting_id', first)
  await add('sighting_id', second)
  await expect(add('observation_id', observation)).rejects.toThrow('Maximum of 2')
  await db.query('DELETE FROM media WHERE sighting_id = $1', [first])
  await expect(add('observation_id', observation)).resolves.toBeUndefined()
})
it('retains existing attachments above a lowered cap and rejects further additions', async () => {
  await add('sighting_id', first, 6)
  await db.exec('UPDATE app_settings SET max_media_per_report = 3')
  await expect(add('sighting_id', second)).rejects.toThrow('Maximum of 3')
  expect((await db.query('SELECT count(*)::int AS total FROM media')).rows).toEqual([{ total: 6 }])
})
