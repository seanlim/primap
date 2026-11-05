// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'
const carol = '33333333-3333-4333-8333-333333333333'
const outsider = '44444444-4444-4444-8444-444444444444'
const admin = '55555555-5555-4555-8555-555555555555'
const walk = '66666666-6666-4666-8666-666666666666'
let db: PGlite

function sqlFile(name: string) {
  return readFileSync(resolve('supabase/migrations', name), 'utf8')
}

async function asMember(user: string | null = alice) {
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user ?? ''])
  await db.exec('SET ROLE authenticated')
}

async function markAttendance({
  slotId = walk,
  userId,
  status = 'PRESENT',
  markedBy,
}: {
  slotId?: string
  userId: string
  status?: 'PRESENT' | 'ABSENT'
  markedBy: string
}) {
  return db.query(
    `INSERT INTO public.slot_attendance (slot_id, user_id, status, marked_by)
     VALUES ($1, $2, $3, $4) RETURNING id, status, marked_by`,
    [slotId, userId, status, markedBy]
  )
}

beforeAll(async () => {
  db = new PGlite()
  // Supabase supplies these auth primitives and roles; application policies,
  // tables and triggers come from the repository's real migrations.
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
    '20260719122751_change_observation_schema.sql',
    '20261105090000_add_slot_attendance.sql',
  ]) {
    await db.exec(sqlFile(name))
  }

  await db.exec('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role')

  await db.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
      ('${alice}', 'alice@example.com', '{"full_name":"Alice"}'),
      ('${bob}', 'bob@example.com', '{"full_name":"Bob"}'),
      ('${carol}', 'carol@example.com', '{"full_name":"Carol"}'),
      ('${outsider}', 'outsider@example.com', '{"full_name":"Outsider"}'),
      ('${admin}', 'admin@example.com', '{"full_name":"Admin"}');

    UPDATE public.profiles SET role = 'ADMIN' WHERE id = '${admin}';

    INSERT INTO public.survey_rounds (id, name, start_date, end_date, status)
    VALUES ('${walk}', 'Round 1', '2026-11-01', '2026-11-30', 'OPEN');

    INSERT INTO public.walk_slots (id, round_id, location_name, walk_date, start_time, end_time, max_volunteers)
    VALUES ('${walk}', '${walk}', 'Forest Trail', '2026-11-05', '08:00', '10:00', 5);

    INSERT INTO public.slot_memberships (slot_id, user_id, status) VALUES
      ('${walk}', '${alice}', 'ACTIVE'),
      ('${walk}', '${bob}', 'ACTIVE'),
      ('${walk}', '${carol}', 'CANCELLED');
  `)
})

afterAll(async () => {
  await db.close()
})

describe('slot_attendance RLS', () => {
  it('lets an active member mark another active member present', async () => {
    await asMember(alice)
    const { rows } = await markAttendance({ userId: bob, markedBy: alice })

    expect(rows[0]).toMatchObject({ status: 'PRESENT', marked_by: alice })
  })

  it('lets an active member correct attendance', async () => {
    await asMember(alice)
    const { rows } = await db.query(
      `UPDATE public.slot_attendance
       SET status = 'ABSENT', marked_by = $1
       WHERE slot_id = $2 AND user_id = $3
       RETURNING status, marked_by`,
      [alice, walk, bob]
    )

    expect(rows[0]).toMatchObject({ status: 'ABSENT', marked_by: alice })
  })

  it('rejects attendance written by someone outside the walk', async () => {
    await asMember(outsider)
    await expect(markAttendance({ userId: bob, markedBy: outsider }))
      .rejects.toThrow(/row-level security/i)
  })

  it('rejects an active member marking a cancelled volunteer', async () => {
    await asMember(alice)
    await expect(markAttendance({ userId: carol, markedBy: alice }))
      .rejects.toThrow(/row-level security/i)
  })

  it('rejects marking a user who is not in the slot', async () => {
    await asMember(alice)
    await expect(markAttendance({ userId: outsider, markedBy: alice }))
      .rejects.toThrow(/row-level security/i)
  })

  it('rejects a row whose marked_by is not the caller', async () => {
    await asMember(alice)
    await expect(markAttendance({ userId: bob, markedBy: bob }))
      .rejects.toThrow(/row-level security/i)
  })

  it('lets an admin override attendance without being a participant', async () => {
    await asMember(admin)
    const { rows } = await db.query(
      `UPDATE public.slot_attendance
       SET status = 'PRESENT', marked_by = $1
       WHERE slot_id = $2 AND user_id = $3
       RETURNING status, marked_by`,
      [admin, walk, bob]
    )

    expect(rows[0]).toMatchObject({ status: 'PRESENT', marked_by: admin })
  })

  it('hides attendance from users outside the walk', async () => {
    await asMember(outsider)
    const { rows } = await db.query(
      'SELECT id FROM public.slot_attendance WHERE slot_id = $1',
      [walk]
    )

    expect(rows).toHaveLength(0)
  })

  it('lets a volunteer view their own attendance even after cancelling', async () => {
    await db.exec('RESET ROLE')
    await db.query(
      `UPDATE public.slot_memberships SET status = 'CANCELLED' WHERE slot_id = $1 AND user_id = $2`,
      [walk, bob]
    )
    await db.query(
      `INSERT INTO public.slot_attendance (slot_id, user_id, status, marked_by)
       VALUES ($1, $2, 'PRESENT', $3)
       ON CONFLICT (slot_id, user_id) DO UPDATE SET status = 'PRESENT', marked_by = EXCLUDED.marked_by`,
      [walk, bob, alice]
    )

    await asMember(bob)
    const { rows } = await db.query(
      'SELECT user_id, status FROM public.slot_attendance WHERE slot_id = $1 AND user_id = $2',
      [walk, bob]
    )

    expect(rows[0]).toMatchObject({ user_id: bob, status: 'PRESENT' })
  })
})
