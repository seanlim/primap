// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'
const outsider = '33333333-3333-4333-8333-333333333333'
const walk = '44444444-4444-4444-8444-444444444444'
const observation = '55555555-5555-4555-8555-555555555555'
const sighting = '66666666-6666-4666-8666-666666666666'
const observationPath = `${bob}/${observation}/observation.jpg`
const sightingPath = `${bob}/${sighting}/sighting.jpg`
const migration = '20261023100000_submit_observation_with_cleanup.sql'
let db: PGlite

function sqlFile(name: string) {
  return readFileSync(resolve('supabase/migrations', name), 'utf8')
}

async function asMember(user: string | null = alice) {
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user ?? ''])
  await db.exec('SET ROLE authenticated')
}

async function submit(id = observation, walkId = walk) {
  const { rows } = await db.query<{ result: { success?: boolean; error?: string; file_paths?: string[] } }>(
    'SELECT public.submit_observation_with_cleanup($1, $2) AS result', [id, walkId]
  )
  return rows[0].result
}

async function snapshot() {
  await db.exec('RESET ROLE')
  const { rows } = await db.query(`
    SELECT o.status, o.lat, o.lng, o.submitted_at, o.notes,
      (SELECT count(*)::int FROM public.media WHERE observation_id = o.id) AS observation_media,
      (SELECT count(*)::int FROM public.sightings WHERE observation_id = o.id) AS sightings,
      (SELECT count(*)::int FROM public.media WHERE sighting_id = $2) AS sighting_media
    FROM public.observations o WHERE o.id = $1
  `, [observation, sighting])
  return rows[0]
}

beforeAll(async () => {
  db = new PGlite()
  // Supabase supplies these auth primitives and roles; all application policies,
  // tables and triggers below come from the repository's real migrations.
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  `)
  for (const name of [
    '20260221103142_create_enums.sql',
    '20260221103200_create_core_tables.sql',
    '20260221103221_create_triggers.sql',
    '20260221103247_create_rls_policies.sql',
    '20260402080428_add_other_species_type.sql',
    '20260406090336_add_max_media_per_report_to_app_settings.sql',
    '20260407170314_enforce_max_media_per_report_trigger.sql',
    '20260409042744_add_incident_media_support.sql',
    '20260413095336_allow_service_role_to_update_submitted_observations.sql',
    '20260719122751_change_observation_schema.sql',
    migration,
  ]) await db.exec(sqlFile(name))
  await db.exec('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role')
}, 30_000)

afterAll(async () => { await db?.close() })

beforeEach(async () => {
  await db.exec(`
    RESET ROLE;
    TRUNCATE auth.users, public.survey_rounds, public.app_settings CASCADE;
    INSERT INTO auth.users (id, email) VALUES
      ('${alice}', 'alice@example.test'), ('${bob}', 'bob@example.test'),
      ('${outsider}', 'outsider@example.test');
    INSERT INTO public.survey_rounds (id, name, start_date, end_date)
      VALUES ('77777777-7777-4777-8777-777777777777', 'TEST', '2026-10-01', '2026-10-31');
    INSERT INTO public.walk_slots (id, round_id, location_name, walk_date, start_time, end_time)
      VALUES ('${walk}', '77777777-7777-4777-8777-777777777777', 'TEST', '2026-10-28', '07:00', '09:00');
    INSERT INTO public.slot_memberships (slot_id, user_id)
      VALUES ('${walk}', '${alice}'), ('${walk}', '${bob}');
    INSERT INTO public.observations (id, slot_id, walk_completion, outcome, lat, lng)
      VALUES ('${observation}', '${walk}', 'COMPLETED', 'SIGHTED', 1.35, 103.82);
    INSERT INTO public.sightings (id, observation_id, species, count, lat, lng)
      VALUES ('${sighting}', '${observation}', 'RBL', '2', 1.36, 103.83);
    INSERT INTO public.media (observation_id, file_path, file_name)
      VALUES ('${observation}', '${observationPath}', 'observation.jpg');
    INSERT INTO public.media (sighting_id, file_path, file_name)
      VALUES ('${sighting}', '${sightingPath}', 'sighting.jpg');
  `)
  await asMember()
})

describe('submission migration in isolated PostgreSQL', () => {
  it('submits a shared sighted report and keeps sighting media, including another member’s uploads', async () => {
    expect(await submit()).toEqual({ success: true, file_paths: [observationPath] })
    expect(await snapshot()).toMatchObject({
      status: 'SUBMITTED', lat: null, lng: null,
      observation_media: 0, sightings: 1, sighting_media: 1,
      submitted_at: expect.any(Date),
    })
  })

  it('submits a not-sighted report without removing its GPS or media', async () => {
    await db.exec("RESET ROLE; UPDATE public.observations SET outcome = 'NOT_SIGHTED'")
    await asMember()
    expect(await submit()).toEqual({ success: true, file_paths: [] })
    expect(await snapshot()).toMatchObject({ status: 'SUBMITTED', lat: 1.35, lng: 103.82, observation_media: 1 })
  })

  it.each([null, outsider])('rejects unauthenticated or unjoined caller %s without mutation', async user => {
    const before = await snapshot()
    await asMember(user)
    expect(await submit()).toHaveProperty('error')
    expect(await snapshot()).toEqual(before)
  })

  it('rejects cancelled members without mutation', async () => {
    await db.exec(`RESET ROLE; UPDATE public.slot_memberships SET status = 'CANCELLED' WHERE user_id = '${alice}'`)
    const before = await snapshot()
    await asMember()
    expect(await submit()).toHaveProperty('error')
    expect(await snapshot()).toEqual(before)
  })

  it('rejects mismatched observation/walk IDs', async () => {
    expect(await submit(sighting)).toHaveProperty('error')
    expect(await submit(observation, sighting)).toHaveProperty('error')
    expect(await snapshot()).toMatchObject({ status: 'DRAFT', observation_media: 1 })
  })

  it('rejects repeated submission and keeps the submitted report immutable', async () => {
    expect(await submit()).toHaveProperty('success', true)
    const [update] = await db.exec("UPDATE public.observations SET notes = 'tampered'")
    expect(update.affectedRows).toBe(0)
    expect(await submit()).toHaveProperty('error')
    expect(await snapshot()).toMatchObject({ status: 'SUBMITTED', sighting_media: 1, notes: null })
  })

  it.each([
    ["UPDATE public.observations SET walk_completion = NULL", 'Walk completion is required.'],
    ["UPDATE public.observations SET outcome = NULL", 'Outcome is required.'],
    ['DELETE FROM public.sightings', 'At least one sighting is required when outcome is Sighted.'],
    ['UPDATE public.sightings SET lat = 0', 'GPS location is required for each sighting.'],
    ["UPDATE public.observations SET outcome = 'NOT_SIGHTED', lat = NULL", 'GPS location is required for Not Sighted reports.'],
  ])('rejects invalid report: %s', async (setup, error) => {
    await db.exec('RESET ROLE')
    await db.exec(setup)
    const before = await snapshot()
    await asMember()
    expect(await submit()).toEqual({ error })
    expect(await snapshot()).toEqual(before)
  })

  it.each(['', ' ', '\t\n\r', '\u00a0', '\u2003', '\ufeff', ' \t\u00a0\n'])('rejects whitespace-only Other name %j', async name => {
    await db.exec('RESET ROLE')
    await db.query("UPDATE public.sightings SET species = 'OTHER', species_other = $1", [name])
    await asMember()
    expect(await submit()).toEqual({ error: 'Species name is required when "Other" is selected.' })
    expect(await snapshot()).toMatchObject({ status: 'DRAFT', observation_media: 1 })
  })

  it('accepts a nonblank Other name', async () => {
    await db.exec("RESET ROLE; UPDATE public.sightings SET species = 'OTHER', species_other = E'\\tLangur\\n'")
    await asMember()
    expect(await submit()).toHaveProperty('success', true)
  })

  it('rolls back the status change and all media-row deletion if cleanup raises', async () => {
    await db.exec(`
      RESET ROLE;
      CREATE FUNCTION public.fail_test_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'Synthetic cleanup failure'; END;
      $$;
      CREATE TRIGGER fail_test_cleanup BEFORE DELETE ON public.media
        FOR EACH STATEMENT EXECUTE FUNCTION public.fail_test_cleanup();
    `)
    const before = await snapshot()
    await asMember()
    try {
      await expect(submit()).rejects.toThrow('Synthetic cleanup failure')
      expect(await snapshot()).toEqual(before)
    } finally {
      await db.exec('RESET ROLE; DROP TRIGGER fail_test_cleanup ON public.media; DROP FUNCTION public.fail_test_cleanup()')
    }
  })

  it.each([
    `${bob}/${observation}/foreign-uploader.jpg`,
    `${alice}/${sighting}/foreign-parent.jpg`,
    `${alice}/${observation}/../foreign.jpg`,
    `${alice}/${observation}/..`,
  ])('rejects forged media paths through authenticated INSERT: %s', async path => {
    await expect(db.query(
      'INSERT INTO public.media (observation_id, file_path, file_name) VALUES ($1, $2, $3)',
      [observation, path, 'forged.jpg']
    )).rejects.toThrow(/row-level security/)
  })

  it('allows a member to insert their own canonical observation media path', async () => {
    await expect(db.query(
      'INSERT INTO public.media (observation_id, file_path, file_name) VALUES ($1, $2, $3)',
      [observation, `${alice}/${observation}/fresh.jpg`, 'fresh.jpg']
    )).resolves.toBeDefined()
  })

  it('allows a member to insert their own canonical sighting media path', async () => {
    await expect(db.query(
      'INSERT INTO public.media (sighting_id, file_path, file_name) VALUES ($1, $2, $3)',
      [sighting, `${alice}/${sighting}/fresh.jpg`, 'fresh.jpg']
    )).resolves.toBeDefined()
  })

  it('allows a reporter to insert their own canonical incident media path', async () => {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO public.incidents (slot_id, reported_by, incident_type, description)
       VALUES ($1, $2, 'OTHER', 'Synthetic incident') RETURNING id`, [walk, alice]
    )
    const incident = rows[0].id
    await expect(db.query(
      'INSERT INTO public.media (incident_id, file_path, file_name) VALUES ($1, $2, $3)',
      [incident, `${alice}/${incident}/fresh.jpg`, 'fresh.jpg']
    )).resolves.toBeDefined()
  })

  it('allows service-role imports to restore legacy paths', async () => {
    await db.exec('SET ROLE service_role')
    await expect(db.query(
      'INSERT INTO public.media (observation_id, file_path, file_name) VALUES ($1, $2, $3)',
      [observation, 'legacy/import.jpg', 'import.jpg']
    )).resolves.toBeDefined()
  })

  it('still rejects unjoined inserts with a correctly shaped path', async () => {
    await asMember(outsider)
    await expect(db.query(
      'INSERT INTO public.media (observation_id, file_path, file_name) VALUES ($1, $2, $3)',
      [observation, `${outsider}/${observation}/fresh.jpg`, 'fresh.jpg']
    )).rejects.toThrow(/row-level security/)
  })

  it('never returns pre-existing forged references for privileged deletion', async () => {
    await db.exec('RESET ROLE')
    await db.query(
      'INSERT INTO public.media (observation_id, file_path, file_name) VALUES ($1, $2, $3)',
      [observation, sightingPath, 'legacy-forged.jpg']
    )
    await asMember()
    expect(await submit()).toEqual({ success: true, file_paths: [observationPath] })
    expect(await snapshot()).toMatchObject({ status: 'SUBMITTED', sighting_media: 1 })
  })

  it('does not delete a canonical path also referenced by surviving sighting media', async () => {
    await db.exec('RESET ROLE')
    await db.query(
      'INSERT INTO public.media (sighting_id, file_path, file_name) VALUES ($1, $2, $3)',
      [sighting, observationPath, 'legacy-duplicate.jpg']
    )
    await asMember()
    expect(await submit()).toEqual({ success: true, file_paths: [] })
    expect(await snapshot()).toMatchObject({ status: 'SUBMITTED', sighting_media: 2 })
  })

  it('does not grant anonymous callers RPC execution', async () => {
    await db.exec('SET ROLE anon')
    await expect(submit()).rejects.toThrow(/permission denied/)
  })
})
