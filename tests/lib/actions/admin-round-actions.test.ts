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
  const mockSupabase: Record<string, unknown> = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn().mockReturnValue(methods),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  }
  return { mockSupabase, methods }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

import {
  createRound,
  updateRound,
  updateRoundStatus,
  deleteRound,
  createWalk,
  updateWalk,
  deleteWalk,
  bulkCreateWalks,
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
        highParticipationThreshold: 8,
        maxMediaPerReport: 10,
      })

      expect(result).toEqual({ success: true })
      expect(methods.update).toHaveBeenCalledWith({
        required_walks_per_round: 4,
        late_cancel_hours: 24,
        high_participation_threshold: 8,
        max_media_per_report: 10,
      })
      expect(revalidatePath).toHaveBeenCalledWith('/admin/settings')
    })

    it('returns error when settings not found', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({ data: null, error: null })

      const result = await updateSettings({
        requiredWalksPerRound: 4,
        lateCancelHours: 24,
        highParticipationThreshold: 8,
        maxMediaPerReport: 10,
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
        highParticipationThreshold: 8,
        maxMediaPerReport: 10,
      })

      expect(result).toEqual({ error: 'Update failed' })
    })

    it('includes maxMediaPerReport in update call', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({
        data: { id: 'settings-1' },
        error: null,
      })

      await updateSettings({
        requiredWalksPerRound: 4,
        lateCancelHours: 48,
        highParticipationThreshold: 8,
        maxMediaPerReport: 15,
      })

      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({ max_media_per_report: 15 })
      )
    })

    describe('input validation', () => {
      it('rejects maxMediaPerReport below the allowed range', async () => {
        const result = await updateSettings({
          requiredWalksPerRound: 4,
          lateCancelHours: 48,
          highParticipationThreshold: 8,
          maxMediaPerReport: 0,
        })
        expect(result).toEqual({
          error: expect.stringContaining('Max media per report must be an integer between 1 and 50'),
        })
        expect(methods.update).not.toHaveBeenCalled()
      })

      it('rejects maxMediaPerReport above the allowed range', async () => {
        const result = await updateSettings({
          requiredWalksPerRound: 4,
          lateCancelHours: 48,
          highParticipationThreshold: 8,
          maxMediaPerReport: 51,
        })
        expect(result).toEqual({
          error: expect.stringContaining('Max media per report must be an integer between 1 and 50'),
        })
        expect(methods.update).not.toHaveBeenCalled()
      })

      it('rejects non-integer maxMediaPerReport', async () => {
        const result = await updateSettings({
          requiredWalksPerRound: 4,
          lateCancelHours: 48,
          highParticipationThreshold: 8,
          maxMediaPerReport: 5.5,
        })
        expect(result).toEqual({
          error: expect.stringContaining('Max media per report must be an integer between 1 and 50'),
        })
        expect(methods.update).not.toHaveBeenCalled()
      })

      it('rejects NaN maxMediaPerReport (e.g. parseInt of empty input)', async () => {
        const result = await updateSettings({
          requiredWalksPerRound: 4,
          lateCancelHours: 48,
          highParticipationThreshold: 8,
          maxMediaPerReport: Number.NaN,
        })
        expect(result).toEqual({
          error: expect.stringContaining('Max media per report must be an integer between 1 and 50'),
        })
      })

      it('rejects highParticipationThreshold out of range', async () => {
        const result = await updateSettings({
          requiredWalksPerRound: 4,
          lateCancelHours: 48,
          highParticipationThreshold: 101,
          maxMediaPerReport: 10,
        })

        expect(result).toEqual({
          error: expect.stringContaining('High participation threshold must be an integer between 1 and 100 participations'),
        })
        expect(methods.update).not.toHaveBeenCalled()
      })

      it('rejects NaN highParticipationThreshold', async () => {
        const result = await updateSettings({
          requiredWalksPerRound: 4,
          lateCancelHours: 48,
          highParticipationThreshold: Number.NaN,
          maxMediaPerReport: 10,
        })

        expect(result).toEqual({
          error: expect.stringContaining('High participation threshold must be an integer between 1 and 100 participations'),
        })
      })

      it('rejects requiredWalksPerRound out of range', async () => {
        const result = await updateSettings({
          requiredWalksPerRound: 0,
          lateCancelHours: 48,
          highParticipationThreshold: 8,
          maxMediaPerReport: 10,
        })
        expect(result).toEqual({
          error: expect.stringContaining('Required walks per round must be an integer between 1 and 20'),
        })
      })

      it('rejects lateCancelHours out of range', async () => {
        const result = await updateSettings({
          requiredWalksPerRound: 4,
          lateCancelHours: 200,
          highParticipationThreshold: 8,
          maxMediaPerReport: 10,
        })
        expect(result).toEqual({
          error: expect.stringContaining('Late cancellation window must be an integer between 1 and 168 hours'),
        })
      })

      it('reports multiple validation errors joined together', async () => {
        const result = await updateSettings({
          requiredWalksPerRound: 0,
          lateCancelHours: 0,
          highParticipationThreshold: 0,
          maxMediaPerReport: 0,
        })
        expect(result.error).toContain('Required walks per round must be an integer between 1 and 20')
        expect(result.error).toContain('Late cancellation window must be an integer between 1 and 168 hours')
        expect(result.error).toContain('Max media per report must be an integer between 1 and 50')
        expect(result.error).toContain('High participation threshold must be an integer between 1 and 100 participations')
      })

      it('does not call requireAdmin/db when validation fails', async () => {
        await updateSettings({
          requiredWalksPerRound: 0,
          lateCancelHours: 48,
          highParticipationThreshold: 8,
          maxMediaPerReport: 10,
        })
        // requireAdmin is not invoked, so neither auth nor db access should happen
        expect(mockSupabase.from).not.toHaveBeenCalled()
        const authMock = (mockSupabase as { auth: { getUser: ReturnType<typeof vi.fn> } }).auth
        expect(authMock.getUser).not.toHaveBeenCalled()
      })

      it('accepts boundary values: min', async () => {
        setupAdmin()
        methods.single.mockResolvedValueOnce({
          data: { id: 'settings-1' },
          error: null,
        })

        const result = await updateSettings({
          requiredWalksPerRound: 1,
          lateCancelHours: 1,
          highParticipationThreshold: 1,
          maxMediaPerReport: 1,
        })

        expect(result).toEqual({ success: true })
      })

      it('accepts boundary values: max', async () => {
        setupAdmin()
        methods.single.mockResolvedValueOnce({
          data: { id: 'settings-1' },
          error: null,
        })

        const result = await updateSettings({
          requiredWalksPerRound: 20,
          lateCancelHours: 168,
          highParticipationThreshold: 100,
          maxMediaPerReport: 50,
        })

        expect(result).toEqual({ success: true })
      })
    })
  })

  describe('updateRound', () => {
    it('updates a round and revalidates', async () => {
      setupAdmin()

      const result = await updateRound('round-1', roundData)

      expect(result).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('survey_rounds')
      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Round 1', start_date: '2026-04-01' })
      )
      expect(revalidatePath).toHaveBeenCalledWith('/admin/rounds')
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
    })

    it('returns validation error for empty name', async () => {
      const result = await updateRound('round-1', { ...roundData, name: '' })
      expect(result).toEqual({ error: expect.stringContaining('Round name is required') })
    })

    it('returns validation error when start date after end date', async () => {
      const result = await updateRound('round-1', {
        ...roundData,
        startDate: '2026-05-01',
        endDate: '2026-04-01',
      })
      expect(result).toEqual({ error: expect.stringContaining('Start date must be before end date') })
    })

    it('returns error on DB failure', async () => {
      setupAdmin()
      methods.eq
        .mockReturnValueOnce(methods)
        .mockReturnValueOnce({ error: { message: 'Update failed' } })

      const result = await updateRound('round-1', roundData)

      expect(result).toEqual({ error: 'Update failed' })
    })
  })

  describe('updateWalk', () => {
    it('updates a slot and revalidates', async () => {
      setupAdmin()

      const result = await updateWalk('slot-1', walkData)

      expect(result).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('walk_slots')
      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({
          location_name: 'Central Park',
          walk_date: '2026-04-15',
          max_volunteers: 3,
        })
      )
      expect(revalidatePath).toHaveBeenCalledWith('/admin/walks')
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
    })

    it('returns validation error for missing walk ID', async () => {
      const result = await updateWalk('', walkData)
      expect(result).toEqual({ error: 'Walk ID is required' })
    })

    it('returns validation error when start time >= end time', async () => {
      const result = await updateWalk('slot-1', {
        ...walkData,
        startTime: '10:00',
        endTime: '08:00',
      })
      expect(result).toEqual({ error: expect.stringContaining('Start time must be before end time') })
    })

    it('returns validation error for invalid maxVolunteers', async () => {
      const result = await updateWalk('slot-1', {
        ...walkData,
        maxVolunteers: 15,
      })
      expect(result).toEqual({ error: expect.stringContaining('Max volunteers must be between 1 and 10') })
    })

    it('returns error on DB failure', async () => {
      setupAdmin()
      methods.eq
        .mockReturnValueOnce(methods)
        .mockReturnValueOnce({ error: { message: 'Update failed' } })

      const result = await updateWalk('slot-1', walkData)

      expect(result).toEqual({ error: 'Update failed' })
    })
  })

  describe('bulkCreateWalks', () => {
    it('invokes edge function and revalidates', async () => {
      setupAdmin()
      mockSupabase.functions = {
        invoke: vi.fn().mockResolvedValue({
          data: { success: true, created: 2 },
          error: null,
        }),
      }

      const result = await bulkCreateWalks({
        roundId: 'round-1',
        slots: [
          { locationName: 'Park A', walkDate: '2026-04-15', startTime: '08:00', endTime: '10:00' },
          { locationName: 'Park B', walkDate: '2026-04-16', startTime: '09:00', endTime: '11:00' },
        ],
      })

      expect(result).toEqual({ success: true, created: 2 })
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('bulk-create-walks', {
        body: expect.objectContaining({ roundId: 'round-1' }),
      })
      expect(revalidatePath).toHaveBeenCalledWith('/admin/walks')
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
    })

    it('returns error for missing roundId', async () => {
      const result = await bulkCreateWalks({ roundId: '', slots: [] })
      expect(result).toEqual({ error: 'Round is required' })
    })

    it('returns error for empty slots array', async () => {
      const result = await bulkCreateWalks({ roundId: 'round-1', slots: [] })
      expect(result).toEqual({ error: 'At least one walk is required' })
    })

    it('validates individual slot data', async () => {
      const result = await bulkCreateWalks({
        roundId: 'round-1',
        slots: [
          { locationName: '', walkDate: '2026-04-15', startTime: '08:00', endTime: '10:00' },
        ],
      })
      expect(result).toEqual({ error: expect.stringContaining('Walk 1:') })
      expect(result).toEqual({ error: expect.stringContaining('Location name is required') })
    })

    it('returns error on edge function failure', async () => {
      setupAdmin()
      mockSupabase.functions = {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Edge function failed' },
        }),
      }

      const result = await bulkCreateWalks({
        roundId: 'round-1',
        slots: [
          { locationName: 'Park A', walkDate: '2026-04-15', startTime: '08:00', endTime: '10:00' },
        ],
      })

      expect(result).toEqual({ error: 'Edge function failed' })
    })
  })

  describe('createRound validation', () => {
    it('returns error for empty name', async () => {
      const result = await createRound({ ...roundData, name: '' })
      expect(result).toEqual({ error: expect.stringContaining('Round name is required') })
    })

    it('returns error for missing dates', async () => {
      const result = await createRound({ ...roundData, startDate: '', endDate: '' })
      expect(result).toEqual({ error: expect.stringContaining('Start date is required') })
    })

    it('returns error for invalid date order', async () => {
      const result = await createRound({
        ...roundData,
        startDate: '2026-05-01',
        endDate: '2026-04-01',
      })
      expect(result).toEqual({ error: expect.stringContaining('Start date must be before end date') })
    })
  })

  describe('createWalk validation', () => {
    it('returns error for missing location name', async () => {
      const result = await createWalk({ ...walkData, locationName: '' })
      expect(result).toEqual({ error: expect.stringContaining('Location name is required') })
    })

    it('returns error for invalid time order', async () => {
      const result = await createWalk({ ...walkData, startTime: '12:00', endTime: '08:00' })
      expect(result).toEqual({ error: expect.stringContaining('Start time must be before end time') })
    })

    it('returns error for maxVolunteers out of range', async () => {
      const result = await createWalk({ ...walkData, maxVolunteers: 0 })
      expect(result).toEqual({ error: expect.stringContaining('Max volunteers must be between 1 and 10') })
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
