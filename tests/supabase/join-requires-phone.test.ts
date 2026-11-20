// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let db: PGlite

const slotId = '11111111-1111-4111-8111-111111111111'
const userWithPhone = '22222222-2222-4222-8222-222222222222'
const userWithoutPhone = '33333333-3333-4333-8333-333333333333'
const userWithBlankPhone = '44444444-4444-4444-8444-444444444444'
const minorWithoutRequirements = '55555555-5555-4555-8555-555555555555'
const minorWithRequirements = '66666666-6666-4666-8666-666666666666'
const roundId = '77777777-7777-4777-8777-777777777777'

function extractFunction(sql: string, name: string): string {
  const pattern = new RegExp(
    `create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
    'i'
  )
  const match = sql.match(pattern)
  if (!match) throw new Error(`Could not find function ${name}`)
  return match[0]
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create type public.user_role as enum ('VOLUNTEER', 'ADMIN');
    create table profiles (
      id uuid primary key,
      phone_number text,
      birth_month date,
      role public.user_role not null default 'VOLUNTEER'
    );
    create table survey_rounds (
      id uuid primary key,
      start_date date not null,
      minor_workshop_required boolean not null default false
    );
    create table walk_slots (id uuid primary key, max_volunteers int, round_id uuid not null);
    create table round_participation_requirements (
      round_id uuid not null,
      user_id uuid not null,
      guardian_name text,
      guardian_email text,
      guardian_accompaniment_acknowledged_at timestamptz,
      guardian_workshop_attended_at timestamptz,
      primary key (round_id, user_id)
    );
    create table slot_memberships (
      id uuid primary key default gen_random_uuid(),
      slot_id uuid,
      user_id uuid,
      status text,
      cancelled_at timestamptz,
      joined_at timestamptz default now()
    );
    create table observations (
      id uuid primary key default gen_random_uuid(),
      slot_id uuid unique,
      status text
    );
  `)

  const migration = readFileSync(
    resolve('supabase/migrations/20261031120000_require_volunteer_phone.sql'),
    'utf8'
  )
  await db.exec(extractFunction(migration, 'normalize_phone_e164'))
  const guardianMigration = readFileSync(
    resolve('supabase/migrations/20261106120000_minor_guardian_workflow.sql'),
    'utf8'
  )
  await db.exec(extractFunction(guardianMigration, 'is_minor_at_round_start'))
  await db.exec(extractFunction(guardianMigration, 'join_slot_with_observation'))
}, 30_000)

afterAll(async () => {
  await db?.close()
})

beforeEach(async () => {
  await db.exec('truncate profiles, survey_rounds, walk_slots, round_participation_requirements, slot_memberships, observations')
  await db.query(`insert into profiles (id, phone_number, birth_month) values
    ($1, $2, '2000-01-01'), ($3, null, '2000-01-01'), ($4, $5, '2000-01-01'),
    ($6, '+6591234567', '2010-05-01'), ($7, '+6591234568', '2010-06-01')`, [
    userWithPhone,
    '+6591234567',
    userWithoutPhone,
    userWithBlankPhone,
    '   ',
    minorWithoutRequirements,
    minorWithRequirements,
  ])
  await db.query('insert into survey_rounds (id, start_date) values ($1, $2)', [roundId, '2026-04-01'])
  await db.query('insert into walk_slots (id, max_volunteers, round_id) values ($1, 3, $2)', [slotId, roundId])
  await db.query(`insert into round_participation_requirements (
    round_id, user_id, guardian_name, guardian_email, guardian_accompaniment_acknowledged_at
  ) values ($1, $2, 'Guardian', 'guardian@example.com', now())`, [roundId, minorWithRequirements])
})

async function join(userId: string) {
  const result = await db.query<{ result: Record<string, unknown> }>(
    'select public.join_slot_with_observation($1, $2) as result',
    [slotId, userId]
  )
  return result.rows[0].result
}

describe('join_slot_with_observation phone gate', () => {
  it('refuses to join when the volunteer has no phone number', async () => {
    const result = await join(userWithoutPhone)

    expect(result).toEqual({
      error: 'Add a phone number to your profile before joining a walk.',
      code: 'PHONE_REQUIRED',
    })
    expect((await db.query('select count(*)::int as total from slot_memberships')).rows).toEqual([
      { total: 0 },
    ])
  })

  it('refuses to join when the stored phone number is blank', async () => {
    const result = await join(userWithBlankPhone)

    expect(result).toMatchObject({ code: 'PHONE_REQUIRED' })
  })

  it('joins and creates a draft observation when a phone number is present', async () => {
    const result = await join(userWithPhone)

    expect(result).toMatchObject({ success: true })
    expect((await db.query('select status from slot_memberships')).rows).toEqual([
      { status: 'ACTIVE' },
    ])
    expect((await db.query('select status from observations')).rows).toEqual([
      { status: 'DRAFT' },
    ])
  })

  it('requires birth month/year for volunteers before joining', async () => {
    await db.query('update profiles set birth_month = null where id = $1', [userWithPhone])

    expect(await join(userWithPhone)).toEqual({
      error: 'Add your birth month and year to your profile before joining a walk.',
      code: 'BIRTH_MONTH_REQUIRED',
    })
    expect((await db.query<{ total: number }>('select count(*)::int as total from slot_memberships')).rows[0].total).toBe(0)
  })

  it('requires guardian details and accompaniment acknowledgement for a minor', async () => {
    expect(await join(minorWithoutRequirements)).toEqual({
      error: 'Add your guardian details for this survey round before joining a walk.',
      code: 'GUARDIAN_DETAILS_REQUIRED',
    })
    expect((await db.query<{ total: number }>('select count(*)::int as total from slot_memberships')).rows[0].total).toBe(0)
  })

  it('requires admin-confirmed workshop attendance when enabled for the round', async () => {
    await db.query('update survey_rounds set minor_workshop_required = true where id = $1', [roundId])

    expect(await join(minorWithRequirements)).toEqual({
      error: 'Your admin must confirm guardian workshop attendance before you can join a walk.',
      code: 'GUARDIAN_WORKSHOP_REQUIRED',
    })
    expect((await db.query<{ total: number }>('select count(*)::int as total from slot_memberships')).rows[0].total).toBe(0)
  })

  it('allows a minor to join after guardian requirements and workshop are complete', async () => {
    await db.query('update survey_rounds set minor_workshop_required = true where id = $1', [roundId])
    await db.query(
      'update round_participation_requirements set guardian_workshop_attended_at = now() where round_id = $1 and user_id = $2',
      [roundId, minorWithRequirements]
    )

    expect(await join(minorWithRequirements)).toMatchObject({ success: true })
  })
})

describe('normalize_phone_e164', () => {
  it.each([
    ['9123 4567', '+6591234567'],
    ['+65 9123 4567', '+6591234567'],
    ['6591234567', '+6591234567'],
    ['+1 415 555 0132', '+14155550132'],
  ])('normalises %s to %s', async (input, expected) => {
    const result = await db.query<{ normalized: string | null }>(
      'select public.normalize_phone_e164($1) as normalized',
      [input]
    )
    expect(result.rows[0].normalized).toBe(expected)
  })

  it.each(['', '   ', '12345', '71234567', 'not a phone'])(
    'returns null for invalid input %j',
    async (input) => {
      const result = await db.query<{ normalized: string | null }>(
        'select public.normalize_phone_e164($1) as normalized',
        [input]
      )
      expect(result.rows[0].normalized).toBeNull()
    }
  )
})
