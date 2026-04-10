import { revalidatePath } from 'next/cache'

const { mockSupabase, methods } = vi.hoisted(() => {
  const methods = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn(),
  }
  for (const key of Object.keys(methods) as (keyof typeof methods)[]) {
    if (key !== 'single' && key !== 'maybeSingle' && key !== 'rpc') methods[key].mockReturnThis()
  }
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    storage: {
      from: vi.fn(),
    },
    from: vi.fn().mockReturnValue(methods),
    rpc: vi.fn(),
  }
  return { mockSupabase, methods }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/email', () => ({
  sendWalkCancellationEmail: vi.fn(),
}))

import { joinWalk, cancelWalk } from '@/lib/actions/walk-actions'
import { sendWalkCancellationEmail } from '@/lib/email'

function resetChain() {
  methods.select.mockReturnThis()
  methods.insert.mockReturnThis()
  methods.update.mockReturnThis()
  methods.delete.mockReturnThis()
  methods.upsert.mockReturnThis()
  methods.eq.mockReturnThis()
  methods.neq.mockReturnThis()
  methods.in.mockReturnThis()
  methods.limit.mockReturnThis()
  methods.maybeSingle.mockResolvedValue({ data: null, error: null })
  methods.single.mockResolvedValue({ data: null, error: null })
  mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
  mockSupabase.from.mockReturnValue(methods)
  mockSupabase.storage.from.mockReturnValue({
    remove: vi.fn().mockResolvedValue({ error: null }),
  })
}

function setupUser(userId = 'user-1') {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
  })
}

function mockJoinableSlot(overrides?: Partial<{
  walk_date: string
  start_time: string
  max_volunteers: number
  survey_rounds: { status: string }
  slot_memberships: Array<{ user_id: string; status: string }>
}>) {
  methods.single.mockResolvedValueOnce({
    data: {
      walk_date: '2099-04-15',
      start_time: '08:00',
      max_volunteers: 3,
      survey_rounds: { status: 'OPEN' },
      slot_memberships: [],
      ...overrides,
    },
    error: null,
  })
}

function setupCancelMocks(overrides?: {
  rpcResult?: {
    success?: boolean
    error?: string
    deleted_draft_count?: number
    file_paths?: string[]
  } | null
  rpcError?: { message: string } | null
  storageError?: { message: string } | null
  slot?: { walk_date: string; start_time: string; location_name: string } | null
  profile?: { full_name: string | null; email: string | null } | null
  otherMembers?: Array<{ user_id: string; profiles: { email: string | null } }>
}) {
  const rpcResult = overrides && 'rpcResult' in overrides
    ? overrides.rpcResult
    : { success: true, deleted_draft_count: 0, file_paths: [] }
  const rpcError = overrides?.rpcError ?? null
  const storageError = overrides?.storageError ?? null
  const slot = overrides && 'slot' in overrides
    ? overrides.slot
    : { walk_date: '2026-04-15', start_time: '08:00', location_name: 'Central Park' }
  const profile = overrides && 'profile' in overrides
    ? overrides.profile
    : { full_name: 'Test User', email: 'user@test.com' }
  const otherMembers = overrides && 'otherMembers' in overrides
    ? overrides.otherMembers
    : [{ user_id: 'other-1', profiles: { email: 'other@test.com' } }]

  mockSupabase.rpc.mockResolvedValue({
    data: rpcResult,
    error: rpcError,
  })
  mockSupabase.storage.from.mockReturnValue({
    remove: vi.fn().mockResolvedValue({ error: storageError }),
  })

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'slot_memberships') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockResolvedValue({
                data: otherMembers,
                error: null,
              }),
            }),
          }),
        }),
      }
    }

    if (table === 'walk_slots') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: slot,
              error: null,
            }),
          }),
        }),
      }
    }

    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: profile,
              error: null,
            }),
          }),
        }),
      }
    }

    return methods
  })
}

describe('walk-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
  })

  describe('joinWalk', () => {
    it('returns error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    // TC-UNIT-WALK-01 (UC-03): Successful sign up for a walk slot
    it('calls RPC and returns success', async () => {
      setupUser()
      mockJoinableSlot()
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true, membership_id: 'mem-1', observation_id: 'obs-1' },
        error: null,
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('join_slot_with_observation', {
        p_slot_id: 'slot-1',
        p_user_id: 'user-1',
      })
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
      expect(revalidatePath).toHaveBeenCalledWith('/walk/slot-1')
      expect(revalidatePath).toHaveBeenCalledWith('/home')
      expect(revalidatePath).toHaveBeenCalledWith('/report')
      expect(revalidatePath).toHaveBeenCalledWith('/report/slot-1')
      expect(revalidatePath).toHaveBeenCalledWith('/profile')
    })

    // TC-UNIT-WALK-02 (UC-03 A1): Slot full prevents sign up
    it('returns "Slot is full" before calling RPC', async () => {
      setupUser()
      mockJoinableSlot({
        max_volunteers: 1,
        slot_memberships: [{ user_id: 'other-user', status: 'ACTIVE' }],
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'This walk has reached its volunteer limit.' })
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })

    // TC-UNIT-WALK-03 (UC-03 A2): Duplicate sign up is blocked
    it('returns "already joined" before calling RPC', async () => {
      setupUser()
      mockJoinableSlot({
        slot_memberships: [{ user_id: 'user-1', status: 'ACTIVE' }],
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'You have already joined this walk.' })
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
    })

    it('returns generic DB error from RPC', async () => {
      setupUser()
      mockJoinableSlot()
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Unexpected error' },
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'Unexpected error' })
    })

    it('handles re-join after cancel (RPC reactivates membership)', async () => {
      setupUser()
      mockJoinableSlot({
        slot_memberships: [{ user_id: 'user-1', status: 'CANCELLED' }],
      })
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true, membership_id: 'mem-1', observation_id: 'obs-1' },
        error: null,
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('join_slot_with_observation', {
        p_slot_id: 'slot-1',
        p_user_id: 'user-1',
      })
    })
  })

  describe('cancelWalk', () => {
    it('returns error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    // TC-UNIT-WALK-04 (UC-04): Cancel participation successfully and notify peers
    it('cancels slot and sends email notification', async () => {
      setupUser()
      setupCancelMocks()

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('cancel_slot_with_draft_cleanup', {
        p_slot_id: 'slot-1',
      })
      expect(sendWalkCancellationEmail).toHaveBeenCalledWith(
        ['other@test.com'],
        { date: '2026-04-15', time: '08:00', location: 'Central Park' },
        'Test User'
      )
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
      expect(revalidatePath).toHaveBeenCalledWith('/report')
      expect(revalidatePath).toHaveBeenCalledWith('/report/slot-1')
      expect(revalidatePath).toHaveBeenCalledWith('/profile')
    })

    it('returns error when DB update fails', async () => {
      setupUser()
      setupCancelMocks({
        rpcError: { message: 'Update failed' },
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ error: 'Update failed' })
    })

    it('returns error when no active membership is cancelled', async () => {
      setupUser()
      setupCancelMocks({
        rpcResult: { error: 'You are not actively joined to this walk.' },
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ error: 'You are not actively joined to this walk.' })
    })

    it('returns error when a submitted report already exists', async () => {
      setupUser()
      setupCancelMocks({
        rpcResult: { error: "You can't cancel this walk after submitting your report." },
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ error: "You can't cancel this walk after submitting your report." })
    })

    it('returns error when RPC returns an unexpected empty payload', async () => {
      setupUser()
      setupCancelMocks({
        rpcResult: null,
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ error: 'Unexpected cancellation response.' })
    })

    it('still succeeds when slot is not found for email', async () => {
      setupUser()
      setupCancelMocks({
        slot: null,
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(sendWalkCancellationEmail).not.toHaveBeenCalled()
    })

    it('still succeeds when no other members', async () => {
      setupUser()
      setupCancelMocks({
        otherMembers: [],
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(sendWalkCancellationEmail).not.toHaveBeenCalled()
    })

    it('still succeeds when recipients are empty after filter', async () => {
      setupUser()
      setupCancelMocks({
        otherMembers: [{ user_id: 'other-1', profiles: { email: null } }],
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(sendWalkCancellationEmail).not.toHaveBeenCalled()
    })

    // TC-UNIT-WALK-05 (UC-04 robustness): Cancellation still succeeds when email fails
    it('returns success with warning when email notification throws', async () => {
      setupUser()
      setupCancelMocks()
      vi.mocked(sendWalkCancellationEmail).mockRejectedValueOnce(
        new Error('Email service down')
      )

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({
        success: true,
        warning: 'Cancelled successfully, but failed to notify other members.',
      })
    })

    it('returns success with warning when draft cleanup fails', async () => {
      setupUser()
      setupCancelMocks({
        rpcResult: { success: true, deleted_draft_count: 1, file_paths: ['drafts/user-1/photo.jpg'] },
      })
      mockSupabase.storage.from.mockReturnValueOnce({
        remove: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({
        success: true,
        warning: 'Cancelled successfully, but failed to remove your draft report media.',
      })
      expect(sendWalkCancellationEmail).toHaveBeenCalled()
    })

    it('uses full_name for cancellingName', async () => {
      setupUser()
      setupCancelMocks({
        profile: { full_name: 'Jane Doe', email: 'jane@test.com' },
      })

      await cancelWalk('slot-1')

      expect(sendWalkCancellationEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'Jane Doe'
      )
    })

    it('falls back to email for cancellingName', async () => {
      setupUser()
      setupCancelMocks({
        profile: { full_name: null, email: 'jane@test.com' },
      })

      await cancelWalk('slot-1')

      expect(sendWalkCancellationEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'jane@test.com'
      )
    })

    it('falls back to "A volunteer" for cancellingName', async () => {
      setupUser()
      setupCancelMocks({
        profile: { full_name: null, email: null },
      })

      await cancelWalk('slot-1')

      expect(sendWalkCancellationEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'A volunteer'
      )
    })
  })
})
