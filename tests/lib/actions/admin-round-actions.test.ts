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

import {
  createRound,
  updateRoundStatus,
  deleteRound,
  createWalk,
  deleteWalk,
  updateSettings,
  resolveIncident,
} from '@/lib/actions/admin-round-actions'

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

function setupAdmin() {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: 'admin-1' } },
  })
  methods.single.mockResolvedValueOnce({ data: { role: 'ADMIN' }, error: null })
}

const roundData = {
  name: 'Round 1',
  description: 'Test round',
  startDate: '2026-04-01',
  endDate: '2026-04-30',
}

const walkData = {
  roundId: 'round-1',
  locationName: 'Central Park',
  walkDate: '2026-04-15',
  startTime: '08:00',
  endTime: '10:00',
}

describe('admin-round-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
  })

  describe('requireAdmin', () => {
    it('throws when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      await expect(createRound(roundData)).rejects.toThrow('Not authenticated')
    })

    it('throws when not admin', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
      })
      methods.single.mockResolvedValueOnce({
        data: { role: 'VOLUNTEER' },
        error: null,
      })

      await expect(createRound(roundData)).rejects.toThrow('Not authorized')
    })
  })

  describe('createRound', () => {
    it('creates a round and revalidates', async () => {
      setupAdmin()

      const result = await createRound(roundData)

      expect(result).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('survey_rounds')
      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Round 1',
          status: 'DRAFT',
          created_by: 'admin-1',
        })
      )
      expect(revalidatePath).toHaveBeenCalledWith('/admin/rounds')
    })

    it('returns error on DB insert failure', async () => {
      setupAdmin()
      methods.insert.mockReturnValueOnce({
        error: { message: 'Insert failed' },
      })

      const result = await createRound(roundData)

      expect(result).toEqual({ error: 'Insert failed' })
      expect(revalidatePath).not.toHaveBeenCalled()
    })
  })

  describe('updateRoundStatus', () => {
    it.each(['DRAFT', 'OPEN', 'CLOSED'] as const)(
      'updates round status to %s',
      async (status: 'DRAFT' | 'OPEN' | 'CLOSED') => {
        setupAdmin()

        const result = await updateRoundStatus('round-1', status)

        expect(result).toEqual({ success: true })
        expect(methods.update).toHaveBeenCalledWith({ status })
        expect(revalidatePath).toHaveBeenCalledWith('/admin/rounds')
        expect(revalidatePath).toHaveBeenCalledWith('/walk')
      }
    )

    it('returns error on DB failure', async () => {
      setupAdmin()
      // requireAdmin calls eq once, then action calls eq once
      methods.eq
        .mockReturnValueOnce(methods) // requireAdmin's eq
        .mockReturnValueOnce({ error: { message: 'Update failed' } }) // action's eq

      const result = await updateRoundStatus('round-1', 'OPEN')

      expect(result).toEqual({ error: 'Update failed' })
      expect(revalidatePath).not.toHaveBeenCalled()
    })
  })

  describe('deleteRound', () => {
    it('deletes a round and revalidates', async () => {
      setupAdmin()

      const result = await deleteRound('round-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('survey_rounds')
      expect(methods.delete).toHaveBeenCalled()
      expect(revalidatePath).toHaveBeenCalledWith('/admin/rounds')
    })

    it('returns error on DB failure', async () => {
      setupAdmin()
      methods.eq
        .mockReturnValueOnce(methods) // requireAdmin's eq
        .mockReturnValueOnce({ error: { message: 'Delete failed' } }) // action's eq

      const result = await deleteRound('round-1')

      expect(result).toEqual({ error: 'Delete failed' })
    })
  })

  describe('createWalk', () => {
    it('creates a slot with default maxVolunteers of 3', async () => {
      setupAdmin()

      const result = await createWalk(walkData)

      expect(result).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('walk_slots')
      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({ max_volunteers: 3 })
      )
      expect(revalidatePath).toHaveBeenCalledWith('/admin/walks')
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
    })

    it('creates a slot with custom maxVolunteers', async () => {
      setupAdmin()

      const result = await createWalk({ ...walkData, maxVolunteers: 5 })

      expect(result).toEqual({ success: true })
      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({ max_volunteers: 5 })
      )
    })

    it('returns error on DB failure', async () => {
      setupAdmin()
      methods.insert.mockReturnValueOnce({
        error: { message: 'Slot insert failed' },
      })

      const result = await createWalk(walkData)

      expect(result).toEqual({ error: 'Slot insert failed' })
    })
  })

  describe('deleteWalk', () => {
    it('deletes a slot and revalidates', async () => {
      setupAdmin()

      const result = await deleteWalk('slot-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('walk_slots')
      expect(revalidatePath).toHaveBeenCalledWith('/admin/walks')
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
    })

    it('returns error on DB failure', async () => {
      setupAdmin()
      methods.eq
        .mockReturnValueOnce(methods) // requireAdmin's eq
        .mockReturnValueOnce({ error: { message: 'Delete failed' } }) // action's eq

      const result = await deleteWalk('slot-1')

      expect(result).toEqual({ error: 'Delete failed' })
    })
  })

  describe('updateSettings', () => {
    it('updates settings when they exist', async () => {
      setupAdmin()
      // second single(): fetch existing settings
      methods.single.mockResolvedValueOnce({
        data: { id: 'settings-1' },
        error: null,
      })

      const result = await updateSettings({
        requiredWalksPerRound: 4,
        lateCancelHours: 24,
      })

      expect(result).toEqual({ success: true })
      expect(methods.update).toHaveBeenCalledWith({
        required_walks_per_round: 4,
        late_cancel_hours: 24,
      })
      expect(revalidatePath).toHaveBeenCalledWith('/admin/settings')
    })

    it('returns error when settings not found', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({ data: null, error: null })

      const result = await updateSettings({
        requiredWalksPerRound: 4,
        lateCancelHours: 24,
      })

      expect(result).toEqual({ error: 'Settings not found' })
    })

    it('returns error on DB update failure', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({
        data: { id: 'settings-1' },
        error: null,
      })
      // requireAdmin calls eq once, updateSettings calls eq once
      methods.eq
        .mockReturnValueOnce(methods) // requireAdmin's eq
        .mockReturnValueOnce({ error: { message: 'Update failed' } }) // action's eq

      const result = await updateSettings({
        requiredWalksPerRound: 4,
        lateCancelHours: 24,
      })

      expect(result).toEqual({ error: 'Update failed' })
    })
  })

  describe('resolveIncident', () => {
    it('resolves an incident and revalidates', async () => {
      setupAdmin()

      const result = await resolveIncident('incident-1', 'Resolved notes')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('incidents')
      expect(methods.update).toHaveBeenCalledWith({
        resolved: true,
        resolved_notes: 'Resolved notes',
      })
      expect(revalidatePath).toHaveBeenCalledWith('/admin/incidents')
    })

    it('returns error on DB failure', async () => {
      setupAdmin()
      methods.eq
        .mockReturnValueOnce(methods) // requireAdmin's eq
        .mockReturnValueOnce({ error: { message: 'Resolve failed' } }) // action's eq

      const result = await resolveIncident('incident-1', 'Notes')

      expect(result).toEqual({ error: 'Resolve failed' })
    })
  })
})
