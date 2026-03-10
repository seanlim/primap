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
  }
  for (const key of Object.keys(methods) as (keyof typeof methods)[]) {
    if (key !== 'single') methods[key].mockReturnThis()
  }
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn().mockReturnValue(methods),
  }
  return { mockSupabase, methods }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/email', () => ({
  sendSlotCancellationEmail: vi.fn(),
}))

import { joinSlot, cancelSlot } from '@/lib/actions/walk-actions'
import { sendSlotCancellationEmail } from '@/lib/email'

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

  describe('joinSlot', () => {
    it('returns error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await joinSlot('slot-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('inserts membership and creates draft observation on success', async () => {
      setupUser()

      const result = await joinSlot('slot-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('slot_memberships')
      expect(methods.insert).toHaveBeenCalledWith({
        slot_id: 'slot-1',
        user_id: 'user-1',
        status: 'ACTIVE',
      })
      expect(mockSupabase.from).toHaveBeenCalledWith('observations')
      expect(methods.insert).toHaveBeenCalledWith({
        slot_id: 'slot-1',
        user_id: 'user-1',
        status: 'DRAFT',
      })
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
      expect(revalidatePath).toHaveBeenCalledWith('/walk/slot-1')
    })

    it('returns "Slot is full" error', async () => {
      setupUser()
      methods.insert.mockReturnValueOnce({
        error: { message: 'Slot is full', code: '' },
      })

      const result = await joinSlot('slot-1')

      expect(result).toEqual({ error: 'This walk slot is full.' })
    })

    it('returns "already joined" error on duplicate (23505)', async () => {
      setupUser()
      methods.insert.mockReturnValueOnce({
        error: { message: 'unique violation', code: '23505' },
      })

      const result = await joinSlot('slot-1')

      expect(result).toEqual({ error: 'You have already joined this walk.' })
    })

    it('returns generic DB error', async () => {
      setupUser()
      methods.insert.mockReturnValueOnce({
        error: { message: 'Unexpected error', code: '' },
      })

      const result = await joinSlot('slot-1')

      expect(result).toEqual({ error: 'Unexpected error' })
    })
  })

  describe('cancelSlot', () => {
    it('returns error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await cancelSlot('slot-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

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

      const result = await cancelSlot('slot-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('slot_memberships')
      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CANCELLED' })
      )
      expect(sendSlotCancellationEmail).toHaveBeenCalledWith(
        ['other@test.com'],
        { date: '2026-04-15', time: '08:00', location: 'Central Park' },
        'Test User'
      )
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
    })

    it('returns error when DB update fails', async () => {
      setupUser()
      // update().eq().eq().eq() — third eq must return error
      methods.eq
        .mockReturnValueOnce(methods) // eq('slot_id', slotId)
        .mockReturnValueOnce(methods) // eq('user_id', user.id)
        .mockReturnValueOnce({ error: { message: 'Update failed' } }) // eq('status', 'ACTIVE')

      const result = await cancelSlot('slot-1')

      expect(result).toEqual({ error: 'Update failed' })
    })

    it('still succeeds when slot is not found for email', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({ data: null, error: null })

      const result = await cancelSlot('slot-1')

      expect(result).toEqual({ success: true })
      expect(sendSlotCancellationEmail).not.toHaveBeenCalled()
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

      const result = await cancelSlot('slot-1')

      expect(result).toEqual({ success: true })
      expect(sendSlotCancellationEmail).not.toHaveBeenCalled()
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

      const result = await cancelSlot('slot-1')

      expect(result).toEqual({ success: true })
      expect(sendSlotCancellationEmail).not.toHaveBeenCalled()
    })

    it('still succeeds when email notification throws', async () => {
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
      vi.mocked(sendSlotCancellationEmail).mockRejectedValueOnce(
        new Error('Email service down')
      )

      const result = await cancelSlot('slot-1')

      expect(result).toEqual({ success: true })
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

      await cancelSlot('slot-1')

      expect(sendSlotCancellationEmail).toHaveBeenCalledWith(
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

      await cancelSlot('slot-1')

      expect(sendSlotCancellationEmail).toHaveBeenCalledWith(
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

      await cancelSlot('slot-1')

      expect(sendSlotCancellationEmail).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'A volunteer'
      )
    })
  })
})
