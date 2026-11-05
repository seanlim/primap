const { mockSupabase, state } = vi.hoisted(() => {
  const draft = {
    id: 'obs-1',
    slot_id: 'slot-1',
    status: 'DRAFT',
    walk_completion: 'COMPLETED',
    outcome: 'NOT_SIGHTED',
    lat: 1.3,
    lng: 103.8,
    updated_at: '2026-11-05T01:00:00Z',
    sightings: [],
  }

  const state = {
    user: { id: 'alice' } as { id: string } | null,
    draft,
    activeMembers: [{ user_id: 'alice' }, { user_id: 'bob' }] as Array<{ user_id: string }>,
    attendanceError: null as { message: string } | null,
    upsertCalls: [] as Array<{ rows: unknown[]; options: unknown }>,
  }

  const observations = {
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            single: async () => ({ data: state.draft, error: null }),
          }),
        }),
      }),
    }),
    update: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: { id: state.draft.id }, error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  }

  const mockSupabase = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: state.user } })),
    },
    from: vi.fn((table: string) => {
      if (table === 'observations') return observations
      if (table === 'slot_memberships') {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: state.activeMembers, error: null }),
            }),
          }),
        }
      }
      if (table === 'slot_attendance') {
        return {
          upsert: async (rows: unknown[], options: unknown) => {
            state.upsertCalls.push({ rows, options })
            return { error: state.attendanceError }
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

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => {
    throw new Error('admin client should not be used for NOT_SIGHTED reports')
  }),
}))

import { submitObservation } from '@/lib/actions/observation-actions'

beforeEach(() => {
  state.user = { id: 'alice' }
  state.activeMembers = [{ user_id: 'alice' }, { user_id: 'bob' }]
  state.attendanceError = null
  state.upsertCalls = []
  vi.clearAllMocks()
})

describe('submitObservation attendance defaults', () => {
  it('marks every active member present when no attendance was recorded', async () => {
    const result = await submitObservation('obs-1', 'slot-1')

    expect(result).toEqual({ success: true, attendanceWarning: undefined })
    expect(state.upsertCalls).toHaveLength(1)
    expect(state.upsertCalls[0].options).toEqual({
      onConflict: 'slot_id,user_id',
      ignoreDuplicates: true,
    })
    expect(state.upsertCalls[0].rows).toEqual([
      { slot_id: 'slot-1', user_id: 'alice', status: 'PRESENT', marked_by: 'alice', marked_at: expect.any(String) },
      { slot_id: 'slot-1', user_id: 'bob', status: 'PRESENT', marked_by: 'alice', marked_at: expect.any(String) },
    ])
  })

  it('still reports success when attendance defaults cannot be written', async () => {
    state.attendanceError = { message: 'permission denied' }
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toMatchObject({ success: true })
      expect('attendanceWarning' in result && result.attendanceWarning).toEqual(expect.stringContaining('attendance could not be recorded'))
    } finally {
      consoleSpy.mockRestore()
    }
  })
})
