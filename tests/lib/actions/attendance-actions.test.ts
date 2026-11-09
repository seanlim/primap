import { revalidatePath } from 'next/cache'

const { mockSupabase, state } = vi.hoisted(() => {
  const state = {
    user: { id: 'alice' } as { id: string } | null,
    role: 'VOLUNTEER' as 'VOLUNTEER' | 'ADMIN',
    membership: { id: 'membership-1' } as { id: string } | null,
    activeMembers: [{ user_id: 'alice' }, { user_id: 'bob' }] as Array<{ user_id: string }>,
    existingAttendance: [] as Array<{ user_id: string; status: 'PRESENT' | 'ABSENT'; guardian_present: boolean | null }>,
    upsertCalls: [] as Array<{ rows: unknown[]; options: unknown }>,
    upsertError: null as { message: string } | null,
  }

  const mockSupabase = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: state.user } })),
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { role: state.role }, error: null }),
            }),
          }),
        }
      }

      if (table === 'slot_memberships') {
        return {
          select: (columns: string) => {
            if (columns === 'id') {
              return {
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: async () => ({ data: state.membership, error: null }),
                    }),
                  }),
                }),
              }
            }
            return {
              eq: () => ({
                eq: () => ({
                  in: async () => ({ data: state.activeMembers, error: null }),
                }),
              }),
            }
          },
        }
      }

      if (table === 'slot_attendance') {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({ data: state.existingAttendance, error: null }),
            }),
          }),
          upsert: async (rows: unknown[], options: unknown) => {
            state.upsertCalls.push({ rows, options })
            return { error: state.upsertError }
          },
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  }

  return { mockSupabase, state }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

import { saveSlotAttendance } from '@/lib/actions/attendance-actions'

function resetState() {
  state.user = { id: 'alice' }
  state.role = 'VOLUNTEER'
  state.membership = { id: 'membership-1' }
  state.activeMembers = [{ user_id: 'alice' }, { user_id: 'bob' }]
  state.existingAttendance = []
  state.upsertCalls = []
  state.upsertError = null
  vi.clearAllMocks()
}

beforeEach(resetState)

describe('saveSlotAttendance', () => {
  it('rejects unauthenticated callers', async () => {
    state.user = null
    expect(await saveSlotAttendance('slot-1', [{ userId: 'bob', status: 'PRESENT' }]))
      .toEqual({ error: 'Not authenticated' })
  })

  it('rejects empty or invalid entries', async () => {
    expect(await saveSlotAttendance('slot-1', []))
      .toEqual({ error: 'Select at least one volunteer.' })
    expect(await saveSlotAttendance('slot-1', [{ userId: 'bob', status: 'MAYBE' as never }]))
      .toEqual({ error: 'Invalid attendance entry.' })
  })

  it('rejects callers who are neither active members nor admins', async () => {
    state.membership = null
    expect(await saveSlotAttendance('slot-1', [{ userId: 'bob', status: 'PRESENT' }]))
      .toEqual({ error: 'You are not part of this walk.' })
    expect(state.upsertCalls).toHaveLength(0)
  })

  it('rejects volunteers who are no longer active in the slot', async () => {
    state.activeMembers = [{ user_id: 'alice' }]
    expect(await saveSlotAttendance('slot-1', [
      { userId: 'alice', status: 'PRESENT' },
      { userId: 'carol', status: 'ABSENT' },
    ])).toEqual({ error: 'Some volunteers are no longer part of this walk. Refresh and try again.' })
    expect(state.upsertCalls).toHaveLength(0)
  })

  it('upserts audited attendance for active members and dedupes entries', async () => {
    const result = await saveSlotAttendance('slot-1', [
      { userId: 'alice', status: 'PRESENT' },
      { userId: 'bob', status: 'ABSENT' },
      { userId: 'bob', status: 'PRESENT' },
    ])

    expect(result).toMatchObject({ success: true })
    expect(state.upsertCalls).toHaveLength(1)
    expect(state.upsertCalls[0].options).toEqual({ onConflict: 'slot_id,user_id' })
    expect(state.upsertCalls[0].rows).toEqual([
      { slot_id: 'slot-1', user_id: 'alice', status: 'PRESENT', guardian_present: null, marked_by: 'alice', marked_at: expect.any(String) },
      { slot_id: 'slot-1', user_id: 'bob', status: 'PRESENT', guardian_present: null, marked_by: 'alice', marked_at: expect.any(String) },
    ])
    for (const path of ['/report', '/report/slot-1', '/profile', '/admin', '/admin/reports', '/admin/reports/slot-1']) {
      expect(revalidatePath).toHaveBeenCalledWith(path)
    }
  })

  it('lets an admin override attendance without being a participant', async () => {
    state.role = 'ADMIN'
    state.membership = null

    const result = await saveSlotAttendance('slot-1', [{ userId: 'bob', status: 'ABSENT' }])

    expect(result).toMatchObject({ success: true })
    expect(state.upsertCalls[0].rows).toEqual([
      { slot_id: 'slot-1', user_id: 'bob', status: 'ABSENT', guardian_present: null, marked_by: 'alice', marked_at: expect.any(String) },
    ])
  })

  it('surfaces database errors', async () => {
    state.upsertError = { message: 'permission denied' }
    expect(await saveSlotAttendance('slot-1', [{ userId: 'bob', status: 'PRESENT' }]))
      .toEqual({ error: 'permission denied' })
  })
})
