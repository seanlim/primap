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
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn(),
  }
  for (const key of Object.keys(methods) as (keyof typeof methods)[]) {
    if (key !== 'single' && key !== 'rpc') methods[key].mockReturnThis()
  }
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
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
  methods.single.mockResolvedValue({ data: null, error: null })
  mockSupabase.rpc.mockResolvedValue({ data: null, error: null })
}

function setupUser(userId = 'user-1') {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
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
    })

    // TC-UNIT-WALK-02 (UC-03 A1): Slot full prevents sign up
    it('returns "Slot is full" error from RPC', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({
        data: { error: 'This walk slot is full.' },
        error: null,
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'This walk slot is full.' })
    })

    // TC-UNIT-WALK-03 (UC-03 A2): Duplicate sign up is blocked
    it('returns "already joined" error from RPC', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({
        data: { error: 'You have already joined this walk.' },
        error: null,
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'You have already joined this walk.' })
    })

    it('returns generic DB error from RPC', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Unexpected error' },
      })

      const result = await joinWalk('slot-1')

      expect(result).toEqual({ error: 'Unexpected error' })
    })

    it('handles re-join after cancel (RPC reactivates membership)', async () => {
      setupUser()
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
      // single() calls for slot info and profile info
      methods.single
        .mockResolvedValueOnce({
          data: { walk_date: '2026-04-15', start_time: '08:00', location_name: 'Central Park' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { full_name: 'Test User', email: 'user@test.com' },
          error: null,
        })
      // neq() for other members query
      methods.neq.mockReturnValueOnce({
        data: [{ user_id: 'other-1', profiles: { email: 'other@test.com' } }],
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('slot_memberships')
      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CANCELLED' })
      )
      expect(sendWalkCancellationEmail).toHaveBeenCalledWith(
        ['other@test.com'],
        { date: '2026-04-15', time: '08:00', location: 'Central Park' },
        'Test User'
      )
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
      expect(revalidatePath).toHaveBeenCalledWith('/report')
      expect(revalidatePath).toHaveBeenCalledWith('/report/slot-1')
    })

    it('returns error when DB update fails', async () => {
      setupUser()
      // update().eq().eq().eq() — third eq must return error
      methods.eq
        .mockReturnValueOnce(methods) // eq('slot_id', slotId)
        .mockReturnValueOnce(methods) // eq('user_id', user.id)
        .mockReturnValueOnce({ error: { message: 'Update failed' } }) // eq('status', 'ACTIVE')

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ error: 'Update failed' })
    })

    it('still succeeds when slot is not found for email', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({ data: null, error: null })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(sendWalkCancellationEmail).not.toHaveBeenCalled()
    })

    it('still succeeds when no other members', async () => {
      setupUser()
      methods.single
        .mockResolvedValueOnce({
          data: { walk_date: '2026-04-15', start_time: '08:00', location_name: 'Central Park' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { full_name: 'Test User', email: 'user@test.com' },
          error: null,
        })
      methods.neq.mockReturnValueOnce({ data: [] })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(sendWalkCancellationEmail).not.toHaveBeenCalled()
    })

    it('still succeeds when recipients are empty after filter', async () => {
      setupUser()
      methods.single
        .mockResolvedValueOnce({
          data: { walk_date: '2026-04-15', start_time: '08:00', location_name: 'Central Park' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { full_name: 'Test User', email: 'user@test.com' },
          error: null,
        })
      methods.neq.mockReturnValueOnce({
        data: [{ user_id: 'other-1', profiles: { email: null } }],
      })

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(sendWalkCancellationEmail).not.toHaveBeenCalled()
    })

    // TC-UNIT-WALK-05 (UC-04 robustness): Cancellation still succeeds when email fails
    it('returns success with warning when email notification throws', async () => {
      setupUser()
      methods.single
        .mockResolvedValueOnce({
          data: { walk_date: '2026-04-15', start_time: '08:00', location_name: 'Central Park' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { full_name: 'Test User', email: 'user@test.com' },
          error: null,
        })
      methods.neq.mockReturnValueOnce({
        data: [{ user_id: 'other-1', profiles: { email: 'other@test.com' } }],
      })
      vi.mocked(sendWalkCancellationEmail).mockRejectedValueOnce(
        new Error('Email service down')
      )

      const result = await cancelWalk('slot-1')

      expect(result).toEqual({
        success: true,
        warning: 'Cancelled successfully, but failed to notify other members.',
      })
    })

    it('uses full_name for cancellingName', async () => {
      setupUser()
      methods.single
        .mockResolvedValueOnce({
          data: { walk_date: '2026-04-15', start_time: '08:00', location_name: 'Park' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { full_name: 'Jane Doe', email: 'jane@test.com' },
          error: null,
        })
      methods.neq.mockReturnValueOnce({
        data: [{ user_id: 'other-1', profiles: { email: 'other@test.com' } }],
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
      methods.single
        .mockResolvedValueOnce({
          data: { walk_date: '2026-04-15', start_time: '08:00', location_name: 'Park' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { full_name: null, email: 'jane@test.com' },
          error: null,
        })
      methods.neq.mockReturnValueOnce({
        data: [{ user_id: 'other-1', profiles: { email: 'other@test.com' } }],
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
      methods.single
        .mockResolvedValueOnce({
          data: { walk_date: '2026-04-15', start_time: '08:00', location_name: 'Park' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { full_name: null, email: null },
          error: null,
        })
      methods.neq.mockReturnValueOnce({
        data: [{ user_id: 'other-1', profiles: { email: 'other@test.com' } }],
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
