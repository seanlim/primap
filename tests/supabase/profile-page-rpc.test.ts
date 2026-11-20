// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'

const roundCurrent = 'aaaaaaaa-1111-4111-8111-111111111111'
const roundPast = 'aaaaaaaa-2222-4222-8222-222222222222'

const slotDraft = 'bbbbbbbb-1111-4111-8111-111111111111'
const slotSubmitted = 'bbbbbbbb-2222-4222-8222-222222222222'
const slotPast = 'bbbbbbbb-3333-4333-8333-333333333333'
const slotFutureCancelled = 'bbbbbbbb-4444-4444-8444-444444444444'

const obsDraft = 'cccccccc-1111-4111-8111-111111111111'
const obsSubmitted = 'cccccccc-2222-4222-8222-222222222222'
const obsPast = 'cccccccc-3333-4333-8333-333333333333'
const obsFutureCancelled = 'cccccccc-4444-4444-8444-444444444444'

let db: PGlite

function sqlFile(name: string) {
  return readFileSync(resolve('supabase/migrations', name), 'utf8')
}

async function asUser(user: string | null) {
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user ?? ''])
  await db.exec('SET ROLE authenticated')
}

type ProfilePagePayload = {
  profile: { id: string; email: string; status: string } | null
  submitted_observations: Array<{ id: string; slot_id: string; walk_slots: { location_name: string } }>
  walk_history: Array<{ membership_id: string; slot_id: string; history_type: string; walk_slots: { location_name: string } }>
  history_observations: Array<{ id: string; slot_id: string; status: string }>
  attendance: Array<{ slot_id: string; status: string }>
  sightings: Array<{ observation_id: string; species: string }>
  settings: { required_walks_per_round: number } | null
  rounds: Array<{ id: string; name: string }>
  stats: { drafts_pending: number; reports_submitted: number; walks_attended: number }
}

async function profilePage(): Promise<ProfilePagePayload> {
  const result = await db.query<{ payload: ProfilePagePayload }>(
    'select public.get_profile_page() as payload'
  )
  return result.rows[0].payload
}

beforeAll(async () => {
  db = new PGlite()

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
    '20260719122751_change_observation_schema.sql',
    '20261105090000_add_slot_attendance.sql',
    '20261119120000_add_profile_page_rpc.sql',
  ]) {
    await db.exec(sqlFile(name))
  }

  await db.exec('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role')

  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
      ('${alice}', 'alice@example.com', '{"full_name":"Alice"}'),
      ('${bob}', 'bob@example.com', '{"full_name":"Bob"}');

    UPDATE public.profiles SET status = 'ACTIVE' WHERE id = '${alice}';

    INSERT INTO public.app_settings (required_walks_per_round) VALUES (6);

    INSERT INTO public.survey_rounds (id, name, start_date, end_date, status) VALUES
      ('${roundCurrent}', 'Current Round', current_date - 30, current_date + 30, 'OPEN'),
      ('${roundPast}', 'Past Round', current_date - 120, current_date - 60, 'CLOSED');

    INSERT INTO public.walk_slots (id, round_id, location_name, walk_date, start_time, end_time, max_volunteers) VALUES
      ('${slotDraft}', '${roundCurrent}', 'Draft Walk', current_date + 1, '07:00', '09:00', 5),
      ('${slotSubmitted}', '${roundCurrent}', 'Submitted Walk', current_date - 1, '07:00', '09:00', 5),
      ('${slotPast}', '${roundPast}', 'Past Walk', current_date - 90, '07:00', '09:00', 5),
      ('${slotFutureCancelled}', '${roundPast}', 'Future Cancelled Walk', current_date + 5, '07:00', '09:00', 5);

    INSERT INTO public.slot_memberships (slot_id, user_id, status) VALUES
      ('${slotDraft}', '${alice}', 'ACTIVE'),
      ('${slotSubmitted}', '${alice}', 'ACTIVE'),
      ('${slotPast}', '${alice}', 'CANCELLED'),
      ('${slotFutureCancelled}', '${alice}', 'CANCELLED');

    INSERT INTO public.observations (id, slot_id, status, outcome, lat, lng) VALUES
      ('${obsDraft}', '${slotDraft}', 'DRAFT', 'SIGHTED', 1.35, 103.78),
      ('${obsSubmitted}', '${slotSubmitted}', 'SUBMITTED', 'SIGHTED', 1.36, 103.79),
      ('${obsPast}', '${slotPast}', 'SUBMITTED', 'NOT_SIGHTED', NULL, NULL),
      ('${obsFutureCancelled}', '${slotFutureCancelled}', 'SUBMITTED', 'SIGHTED', 1.37, 103.80);

    INSERT INTO public.sightings (observation_id, species, lat, lng) VALUES
      ('${obsSubmitted}', 'RBL', 1.36, 103.79),
      ('${obsFutureCancelled}', 'LTM', 1.37, 103.80);

    INSERT INTO public.slot_attendance (slot_id, user_id, status) VALUES
      ('${slotDraft}', '${alice}', 'PRESENT'),
      ('${slotSubmitted}', '${alice}', 'ABSENT');
  `)
})

afterAll(async () => {
  await db.close()
})

describe('get_profile_page', () => {
  beforeEach(async () => {
    await asUser(alice)
  })

  it('returns the profile row for the calling user', async () => {
    const payload = await profilePage()

    expect(payload.profile).toMatchObject({ id: alice, email: 'alice@example.com', status: 'ACTIVE' })
  })

  it('builds walk history from active memberships, newest walk first', async () => {
    const payload = await profilePage()

    expect(payload.walk_history.map((entry) => entry.slot_id)).toEqual([
      slotDraft,
      slotSubmitted,
    ])
    expect(payload.walk_history.map((entry) => entry.history_type)).toEqual(['active', 'active'])
    // Walks the volunteer cancelled are not part of their history.
    expect(payload.walk_history.map((entry) => entry.slot_id)).not.toContain(slotPast)
    expect(payload.walk_history.map((entry) => entry.slot_id)).not.toContain(slotFutureCancelled)
    expect(payload.walk_history[0].walk_slots.location_name).toBe('Draft Walk')
  })

  it('only returns submitted reports for slots the user is an active member of', async () => {
    const payload = await profilePage()

    expect(payload.submitted_observations.map((o) => o.id)).toEqual([obsSubmitted])
  })

  it('returns observations and attendance for the history slots', async () => {
    const payload = await profilePage()

    // obsPast belongs to a cancelled membership, so RLS hides it here too.
    expect(payload.history_observations.map((o) => o.id).sort()).toEqual(
      [obsDraft, obsSubmitted].sort()
    )
    expect(payload.attendance).toEqual(
      expect.arrayContaining([
        { slot_id: slotDraft, status: 'PRESENT' },
        { slot_id: slotSubmitted, status: 'ABSENT' },
      ])
    )
    expect(payload.attendance).toHaveLength(2)
  })

  it('only returns sightings for the active membership reports', async () => {
    const payload = await profilePage()

    expect(payload.sightings).toEqual([
      expect.objectContaining({ observation_id: obsSubmitted, species: 'RBL' }),
    ])
  })

  it('scopes progress stats to the user slots in the current round', async () => {
    const payload = await profilePage()

    expect(payload.stats).toEqual({
      drafts_pending: 1,
      reports_submitted: 1,
      walks_attended: 1,
    })
  })

  it('returns app settings and open rounds', async () => {
    const payload = await profilePage()

    expect(payload.settings).toEqual({ required_walks_per_round: 6 })
    expect(payload.rounds.map((round) => round.id)).toEqual([roundCurrent])
  })

  it('returns an empty payload for a user without memberships', async () => {
    await asUser(bob)

    const payload = await profilePage()

    expect(payload.profile).toMatchObject({ id: bob })
    expect(payload.walk_history).toEqual([])
    expect(payload.history_observations).toEqual([])
    expect(payload.attendance).toEqual([])
    expect(payload.sightings).toEqual([])
    expect(payload.stats).toEqual({
      drafts_pending: 0,
      reports_submitted: 0,
      walks_attended: 0,
    })
  })
})
