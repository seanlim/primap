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

async function submitDirect(id = observation, walkId = walk) {
  return db.query<{ id: string; status: string }>(
    `UPDATE public.observations SET status = 'SUBMITTED', submitted_at = now(), lat = NULL, lng = NULL
     WHERE id = $1 AND slot_id = $2 AND status = 'DRAFT' RETURNING id, status`, [id, walkId]
  )
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
    '20261023090000_fix_shared_report_cancellation.sql',
    migration,
    '20261024150000_remove_submission_rpc.sql',
  ]) await db.exec(sqlFile(name))
  // Mirror the WITH CHECK fix already applied through the production dashboard.
  await db.exec(`ALTER POLICY "Users can update own draft observations" ON public.observations
    WITH CHECK (public.is_active_slot_member(slot_id))`)
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

describe('TypeScript submission database permissions', () => {
  it('retires both functions while keeping the media INSERT safeguard inline', async () => {
    await db.exec('RESET ROLE')
    const { rows } = await db.query(`SELECT
      to_regprocedure('public.submit_observation_with_cleanup(uuid,uuid)') AS rpc,
      to_regprocedure('public.is_media_path_for_parent(text,uuid)') AS helper,
      (SELECT count(*)::int FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'media'
         AND policyname = 'Media inserts must match uploader and parent'
         AND permissive = 'RESTRICTIVE'
         AND with_check NOT LIKE '%is_media_path_for_parent%') AS policies`)
    expect(rows[0]).toEqual({ rpc: null, helper: null, policies: 1 })
  })

  it.each([
    `${bob}/${observation}/forged.jpg`,
    `${alice}/${sighting}/forged.jpg`,
    `${alice}/${observation}/../forged.jpg`,
    `${alice}/${observation}/..`,
    `${alice}/${observation}/bad\\name.jpg`,
  ])('rejects forged media paths without the SQL helper: %s', async path => {
    await expect(db.query(
      'INSERT INTO public.media (observation_id, file_path, file_name) VALUES ($1, $2, $3)',
      [observation, path, 'forged.jpg']
    )).rejects.toThrow(/row-level security/)
  })

  it('allows a member to upload media for their own draft', async () => {
    await expect(db.query(
      'INSERT INTO public.media (observation_id, file_path, file_name) VALUES ($1, $2, $3)',
      [observation, `${alice}/${observation}/fresh.jpg`, 'fresh.jpg']
    )).resolves.toBeDefined()
  })

  it('allows a member to upload sighting media', async () => {
    await expect(db.query(
      'INSERT INTO public.media (sighting_id, file_path, file_name) VALUES ($1, $2, $3)',
      [sighting, `${alice}/${sighting}/fresh.jpg`, 'fresh.jpg']
    )).resolves.toBeDefined()
  })

  it('allows a reporter to upload incident media', async () => {
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

  it('keeps the cancellation fix installed without changing its body', async () => {
    const { rows } = await db.query<{ prosrc: string }>(
      "SELECT prosrc FROM pg_proc WHERE oid = 'public.cancel_slot_with_draft_cleanup(uuid,text)'::regprocedure"
    )
    const body = sqlFile('20261023090000_fix_shared_report_cancellation.sql').split('$function$')[1]
    expect(rows[0].prosrc).toBe(body)
  })

  it('allows an authenticated member to submit with the dashboard WITH CHECK fix', async () => {
    expect((await submitDirect()).rows).toEqual([{ id: observation, status: 'SUBMITTED' }])
    expect(await snapshot()).toMatchObject({ status: 'SUBMITTED', observation_media: 1, sighting_media: 1 })
  })

  it.each([null, outsider])('rejects an unauthenticated or unjoined update: %s', async user => {
    const before = await snapshot()
    await asMember(user)
    expect((await submitDirect()).rows).toEqual([])
    expect(await snapshot()).toEqual(before)
  })

  it('rejects cancelled members', async () => {
    await db.exec(`RESET ROLE; UPDATE public.slot_memberships SET status = 'CANCELLED' WHERE user_id = '${alice}'`)
    await asMember()
    expect((await submitDirect()).rows).toEqual([])
    expect(await snapshot()).toMatchObject({ status: 'DRAFT', observation_media: 1 })
  })

  it('does not update another walk or submit an observation twice', async () => {
    expect((await submitDirect(observation, sighting)).rows).toEqual([])
    expect((await submitDirect()).rows).toHaveLength(1)
    expect((await submitDirect()).rows).toEqual([])
    expect(await snapshot()).toMatchObject({ status: 'SUBMITTED', observation_media: 1 })
  })

  it('keeps submitted reports immutable to volunteers', async () => {
    await submitDirect()
    const result = await db.query("UPDATE public.observations SET notes = 'tampered' WHERE id = $1 RETURNING id", [observation])
    expect(result.rows).toEqual([])
    expect(await snapshot()).toMatchObject({ status: 'SUBMITTED', notes: null })
  })

  it('requires service-role cleanup after submission and preserves sighting media', async () => {
    await submitDirect()
    const denied = await db.query('DELETE FROM public.media WHERE observation_id = $1 RETURNING file_path', [observation])
    expect(denied.rows).toEqual([])
    await db.exec('SET ROLE service_role')
    const deleted = await db.query('DELETE FROM public.media WHERE observation_id = $1 RETURNING file_path', [observation])
    expect(deleted.rows).toEqual([{ file_path: observationPath }])
    expect(await snapshot()).toMatchObject({ status: 'SUBMITTED', observation_media: 0, sighting_media: 1 })
  })

  it('preserves draft and media when the old draft-only WITH CHECK rejects submission', async () => {
    await db.exec(`RESET ROLE;
      ALTER POLICY "Users can update own draft observations" ON public.observations
      WITH CHECK (status = 'DRAFT' AND public.is_active_slot_member(slot_id))`)
    const before = await snapshot()
    await asMember()
    try {
      await expect(submitDirect()).rejects.toThrow(/row-level security/)
      expect(await snapshot()).toEqual(before)
    } finally {
      await db.exec(`RESET ROLE;
        ALTER POLICY "Users can update own draft observations" ON public.observations
        WITH CHECK (public.is_active_slot_member(slot_id))`)
    }
  })
})
