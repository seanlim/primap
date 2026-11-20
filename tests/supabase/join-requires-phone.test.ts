// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let db: PGlite

const slotId = '11111111-1111-4111-8111-111111111111'
const userWithPhone = '22222222-2222-4222-8222-222222222222'
const userWithoutPhone = '33333333-3333-4333-8333-333333333333'
const userWithBlankPhone = '44444444-4444-4444-8444-444444444444'

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
    create table profiles (id uuid primary key, phone_number text);
    create table walk_slots (id uuid primary key, max_volunteers int);
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
  await db.exec(extractFunction(migration, 'join_slot_with_observation'))
}, 30_000)

afterAll(async () => {
  await db?.close()
})

beforeEach(async () => {
  await db.exec('truncate profiles, walk_slots, slot_memberships, observations')
  await db.query('insert into profiles (id, phone_number) values ($1, $2), ($3, null), ($4, $5)', [
    userWithPhone,
    '+6591234567',
    userWithoutPhone,
    userWithBlankPhone,
    '   ',
  ])
  await db.query('insert into walk_slots (id, max_volunteers) values ($1, 3)', [slotId])
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
