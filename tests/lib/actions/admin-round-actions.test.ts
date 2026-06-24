import { revalidatePath } from 'next/cache'
import type { Mock } from 'vitest'
import {
  DEFAULT_REMINDER_SEND_WEEKDAY,
  DEFAULT_REMINDER_SEND_TIME,
  DEFAULT_REMINDER_WINDOW_LENGTH_DAYS,
  DEFAULT_REMINDER_WINDOW_START_OFFSET_DAYS,
} from '@/lib/constants/settings'

interface MockSupabase {
  auth: { getUser: Mock }
  from: Mock
  functions: { invoke: Mock }
  storage: { from: Mock }
}

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
    then: vi.fn((resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve({ data: null, error: null, count: null }))
    ),
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
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  } satisfies MockSupabase
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
  mockSupabase.from.mockReturnValue(methods)
  methods.select.mockReturnThis()
  methods.insert.mockReturnThis()
  methods.update.mockReturnThis()
  methods.delete.mockReturnThis()
  methods.upsert.mockReturnThis()
  methods.eq.mockReturnThis()
  methods.neq.mockReturnThis()
  methods.in.mockReturnThis()
  methods.limit.mockReturnThis()
  methods.then.mockImplementation((resolve: (value: unknown) => unknown) =>
    Promise.resolve(resolve({ data: null, error: null, count: null }))
  )
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

function mockRoundDateRange(startDate = '2026-04-01', endDate = '2026-04-30') {
  methods.single.mockResolvedValueOnce({
    data: { start_date: startDate, end_date: endDate },
    error: null,
  })
}

function mockExistingWalk(overrides?: Partial<{ walk_date: string; start_time: string; reminder_sent_at: string | null }>) {
  methods.single.mockResolvedValueOnce({
    data: {
      walk_date: '2026-04-15',
      start_time: '08:00:00',
      reminder_sent_at: null,
      ...overrides,
    },
    error: null,
  })
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
      methods.then.mockImplementationOnce((resolve: (value: unknown) => unknown) =>
        Promise.resolve(resolve({ data: [], error: null, count: null }))
      )

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
      methods.then.mockImplementationOnce((resolve: (value: unknown) => unknown) =>
        Promise.resolve(resolve({ data: [], error: null, count: null }))
      )
      methods.insert.mockReturnValueOnce({
        error: { message: 'Insert failed' },
      })

      const result = await createRound(roundData)

      expect(result).toEqual({ error: 'Insert failed' })
      expect(revalidatePath).not.toHaveBeenCalled()
    })

    it('rejects overlapping round dates', async () => {
      setupAdmin()
      methods.then.mockImplementationOnce((resolve: (value: unknown) => unknown) =>
        Promise.resolve(resolve({
          data: [{ id: 'round-2', name: 'Round 2', start_date: '2026-04-15', end_date: '2026-05-15' }],
          error: null,
          count: null,
        }))
      )

      const result = await createRound(roundData)

      expect(result).toEqual({
        error: 'Round dates overlap with Round 2 (2026-04-15 to 2026-05-15). Rounds must not overlap.',
      })
      expect(methods.insert).not.toHaveBeenCalled()
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

    // Regression: deleting a round removes all its walks, so the volunteer
    // /walk listing must be invalidated too. Previously deleteRound only
    // revalidated /admin/rounds, leaving stale entries on the volunteer page.
    it('also revalidates /walk so volunteer listings refresh', async () => {
      setupAdmin()

      const result = await deleteRound('round-1')

      expect(result).toEqual({ success: true })
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
    })

    it('returns error on DB failure', async () => {
      setupAdmin()
      methods.eq
        .mockReturnValueOnce(methods) // requireAdmin's eq
        .mockReturnValueOnce({ error: { message: 'Delete failed' } }) // action's eq

      const result = await deleteRound('round-1')

      expect(result).toEqual({ error: 'Delete failed' })
      // Must NOT revalidate when the delete fails — otherwise the cache is
      // bumped against a no-op DB state.
      expect(revalidatePath).not.toHaveBeenCalled()
    })
  })

  describe('createWalk', () => {
    it('creates a slot with default maxVolunteers of 3', async () => {
      setupAdmin()
      mockRoundDateRange()

      const result = await createWalk(walkData)

      expect(result).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('walk_slots')
      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({ max_volunteers: 3 })
      )
      expect(revalidatePath).toHaveBeenCalledWith('/admin/walks')
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
    })

    it('creates a slot with custom maxVolunteers under the cap', async () => {
      setupAdmin()
      mockRoundDateRange()

      const result = await createWalk({ ...walkData, maxVolunteers: 2 })

      expect(result).toEqual({ success: true })
      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({ max_volunteers: 2 })
      )
    })

    it('returns error on DB failure', async () => {
      setupAdmin()
      mockRoundDateRange()
      methods.insert.mockReturnValueOnce({
        error: { message: 'Slot insert failed' },
      })

      const result = await createWalk(walkData)

      expect(result).toEqual({ error: 'Slot insert failed' })
    })

    it('returns error when walk date is outside the round date range', async () => {
      setupAdmin()
      mockRoundDateRange()

      const result = await createWalk({
        ...walkData,
        walkDate: '2026-05-01',
      })

      expect(result).toEqual({
        error: 'Walk date 2026-05-01 must be between the round start date (2026-04-01) and end date (2026-04-30).',
      })
      expect(methods.insert).not.toHaveBeenCalled()
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

    it('blocks delete when the walk has submitted reports', async () => {
      setupAdmin()
      methods.limit.mockResolvedValueOnce({
        data: [{ id: 'obs-1' }],
        error: null,
      })

      const result = await deleteWalk('slot-1')

      expect(result).toEqual({
        error: 'This walk has submitted reports. Submitted reports must be exported and handled before deleting the walk.',
      })
      expect(methods.delete).not.toHaveBeenCalled()
      expect(revalidatePath).not.toHaveBeenCalled()
    })

    it('allows submitted report deletion only with explicit override', async () => {
      setupAdmin()
      methods.limit.mockResolvedValueOnce({
        data: [{ id: 'obs-1' }],
        error: null,
      })

      const result = await deleteWalk('slot-1', { deleteSubmittedReports: true })

      expect(result).toEqual({ success: true })
      expect(mockSupabase.from).toHaveBeenCalledWith('incidents')
      expect(mockSupabase.from).toHaveBeenCalledWith('slot_memberships')
      expect(mockSupabase.from).toHaveBeenCalledWith('walk_slots')
      expect(revalidatePath).toHaveBeenCalledWith('/admin/walks')
      expect(revalidatePath).toHaveBeenCalledWith('/walk')
    })

    it('returns error on DB failure', async () => {
      setupAdmin()
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'walk_slots') {
          return {
            ...methods,
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
            }),
          }
        }
        return methods
      })

      const result = await deleteWalk('slot-1')

      expect(result).toEqual({ error: 'Delete failed' })
    })

    // ─── Incident media cleanup (regression for issue #64 × PR #68 intersection) ─
    //
    // When an admin deletes a walk that has incidents with attached photos,
    // the media files must be removed from the `incident-media` storage
    // bucket and the corresponding `media` rows must be deleted BEFORE the
    // incident rows are removed (otherwise the FK cascade would orphan the
    // storage objects).

    describe('deleteIncidentsForSlots media cleanup', () => {
      function chain(result: { data: unknown; error: unknown }) {
        const c: Record<string, unknown> = {
          select: vi.fn(() => c),
          delete: vi.fn(() => c),
          in: vi.fn(() => Promise.resolve(result)),
          eq: vi.fn(() => Promise.resolve(result)),
        }
        return c
      }

      it('fetches incident media, removes it from incident-media bucket, deletes media rows, then deletes incidents', async () => {
        setupAdmin()

        // Track per-table chains so we can assert on each one independently.
        const incidentsSelectChain = chain({
          data: [{ id: 'inc-1' }, { id: 'inc-2' }],
          error: null,
        })
        const mediaSelectChain = chain({
          data: [
            { id: 'media-1', file_path: 'user-1/inc-1/a.jpg' },
            { id: 'media-2', file_path: 'user-1/inc-2/b.jpg' },
          ],
          error: null,
        })
        const mediaDeleteChain = chain({ data: null, error: null })
        const incidentsDeleteChain = chain({ data: null, error: null })

        let incidentsFromCallNumber = 0
        let mediaFromCallNumber = 0
        const incidentMediaRemove = vi.fn().mockResolvedValue({ error: null })
        const observationMediaRemove = vi.fn().mockResolvedValue({ error: null })

        mockSupabase.storage.from.mockImplementation((bucket: string) => {
          if (bucket === 'incident-media') return { remove: incidentMediaRemove }
          return { remove: observationMediaRemove }
        })

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'incidents') {
            incidentsFromCallNumber += 1
            // 1st call: select to fetch incident IDs
            // 2nd call: delete the incident rows
            return incidentsFromCallNumber === 1 ? incidentsSelectChain : incidentsDeleteChain
          }
          if (table === 'media') {
            mediaFromCallNumber += 1
            // 1st call: select to fetch media rows
            // 2nd call: delete the media rows by id
            return mediaFromCallNumber === 1 ? mediaSelectChain : mediaDeleteChain
          }
          return methods
        })
        // Block the deleteWalk pre-check that would short-circuit on submitted observations
        methods.limit.mockResolvedValueOnce({ data: [], error: null })

        const result = await deleteWalk('slot-1')

        expect(result).toEqual({ success: true })

        // The incidents table is queried twice: select then delete.
        expect(incidentsSelectChain.select).toHaveBeenCalledWith('id')
        expect(incidentsSelectChain.in).toHaveBeenCalledWith('slot_id', ['slot-1'])
        expect(incidentsDeleteChain.delete).toHaveBeenCalled()
        expect(incidentsDeleteChain.in).toHaveBeenCalledWith('id', ['inc-1', 'inc-2'])

        // The media table is queried twice: select-by-incident then delete-by-id.
        expect(mediaSelectChain.select).toHaveBeenCalledWith('id, file_path')
        expect(mediaSelectChain.in).toHaveBeenCalledWith('incident_id', ['inc-1', 'inc-2'])
        expect(mediaDeleteChain.delete).toHaveBeenCalled()
        expect(mediaDeleteChain.in).toHaveBeenCalledWith('id', ['media-1', 'media-2'])

        // Storage cleanup happens against the incident-media bucket (NOT
        // observation-media), with both file paths.
        expect(mockSupabase.storage.from).toHaveBeenCalledWith('incident-media')
        expect(incidentMediaRemove).toHaveBeenCalledTimes(1)
        expect(incidentMediaRemove).toHaveBeenCalledWith([
          'user-1/inc-1/a.jpg',
          'user-1/inc-2/b.jpg',
        ])
        // We must NOT have used the wrong bucket for incident files.
        expect(observationMediaRemove).not.toHaveBeenCalled()
      })

      it('skips media cleanup when no incidents have attached media', async () => {
        setupAdmin()

        const incidentsSelectChain = chain({ data: [{ id: 'inc-1' }], error: null })
        const mediaSelectChain = chain({ data: [], error: null })
        const incidentsDeleteChain = chain({ data: null, error: null })

        let incidentsFromCallNumber = 0
        const incidentMediaRemove = vi.fn().mockResolvedValue({ error: null })
        mockSupabase.storage.from.mockImplementation((bucket: string) => {
          if (bucket === 'incident-media') return { remove: incidentMediaRemove }
          return { remove: vi.fn().mockResolvedValue({ error: null }) }
        })

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'incidents') {
            incidentsFromCallNumber += 1
            return incidentsFromCallNumber === 1 ? incidentsSelectChain : incidentsDeleteChain
          }
          if (table === 'media') return mediaSelectChain
          return methods
        })
        methods.limit.mockResolvedValueOnce({ data: [], error: null })

        const result = await deleteWalk('slot-1')

        expect(result).toEqual({ success: true })
        // No storage cleanup attempted when there are no media file paths.
        expect(incidentMediaRemove).not.toHaveBeenCalled()
        // The incident row was still deleted.
        expect(incidentsDeleteChain.delete).toHaveBeenCalled()
      })

      it('returns early with no-op when no incidents exist for the slot', async () => {
        setupAdmin()

        const incidentsSelectChain = chain({ data: [], error: null })
        let incidentsFromCalled = false
        const incidentMediaRemove = vi.fn().mockResolvedValue({ error: null })
        mockSupabase.storage.from.mockImplementation((bucket: string) => {
          if (bucket === 'incident-media') return { remove: incidentMediaRemove }
          return { remove: vi.fn().mockResolvedValue({ error: null }) }
        })

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'incidents') {
            incidentsFromCalled = true
            return incidentsSelectChain
          }
          return methods
        })
        methods.limit.mockResolvedValueOnce({ data: [], error: null })

        const result = await deleteWalk('slot-1')

        expect(result).toEqual({ success: true })
        expect(incidentsFromCalled).toBe(true)
        expect(incidentMediaRemove).not.toHaveBeenCalled()
      })

      it('returns error if incident-media storage cleanup fails (does NOT delete incident rows)', async () => {
        setupAdmin()

        const incidentsSelectChain = chain({
          data: [{ id: 'inc-1' }],
          error: null,
        })
        const mediaSelectChain = chain({
          data: [{ id: 'media-1', file_path: 'user-1/inc-1/a.jpg' }],
          error: null,
        })
        const incidentsDeleteChain = chain({ data: null, error: null })
        const mediaDeleteChain = chain({ data: null, error: null })

        let incidentsFromCallNumber = 0
        let mediaFromCallNumber = 0
        const incidentMediaRemove = vi
          .fn()
          .mockResolvedValue({ error: { message: 'Storage offline' } })

        mockSupabase.storage.from.mockImplementation((bucket: string) => {
          if (bucket === 'incident-media') return { remove: incidentMediaRemove }
          return { remove: vi.fn().mockResolvedValue({ error: null }) }
        })

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'incidents') {
            incidentsFromCallNumber += 1
            return incidentsFromCallNumber === 1 ? incidentsSelectChain : incidentsDeleteChain
          }
          if (table === 'media') {
            mediaFromCallNumber += 1
            return mediaFromCallNumber === 1 ? mediaSelectChain : mediaDeleteChain
          }
          return methods
        })
        methods.limit.mockResolvedValueOnce({ data: [], error: null })

        const result = await deleteWalk('slot-1')

        expect(result).toEqual({ error: 'Storage offline' })
        // The function bailed out before deleting media rows or incident rows.
        expect(mediaDeleteChain.delete).not.toHaveBeenCalled()
        expect(incidentsDeleteChain.delete).not.toHaveBeenCalled()
      })
    })
  })

  describe('updateSettings', () => {
    const buildSettingsInput = (overrides?: Partial<{
      requiredWalksPerRound: number
      highParticipationThreshold: number
      maxMediaPerReport: number
      reminderSendWeekday: number
      reminderSendTime: string
      reminderWindowStartOffsetDays: number
      reminderWindowLengthDays: number
    }>) => ({
      requiredWalksPerRound: 4,
      highParticipationThreshold: 8,
      maxMediaPerReport: 10,
      reminderSendWeekday: DEFAULT_REMINDER_SEND_WEEKDAY,
      reminderSendTime: DEFAULT_REMINDER_SEND_TIME.slice(0, 5),
      reminderWindowStartOffsetDays: DEFAULT_REMINDER_WINDOW_START_OFFSET_DAYS,
      reminderWindowLengthDays: DEFAULT_REMINDER_WINDOW_LENGTH_DAYS,
      ...overrides,
    })

    it('updates settings when they exist', async () => {
      setupAdmin()
      // second single(): fetch existing settings
      methods.single.mockResolvedValueOnce({
        data: { id: 'settings-1' },
        error: null,
      })

      const result = await updateSettings(buildSettingsInput())

      expect(result).toEqual({ success: true })
      expect(methods.update).toHaveBeenCalledWith({
        required_walks_per_round: 4,
        high_participation_threshold: 8,
        max_media_per_report: 10,
        reminder_send_weekday: DEFAULT_REMINDER_SEND_WEEKDAY,
        reminder_send_time: DEFAULT_REMINDER_SEND_TIME,
        reminder_window_start_offset_days: DEFAULT_REMINDER_WINDOW_START_OFFSET_DAYS,
        reminder_window_length_days: DEFAULT_REMINDER_WINDOW_LENGTH_DAYS,
      })
      expect(revalidatePath).toHaveBeenCalledWith('/admin/settings')
    })

    it('returns error when settings not found', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({ data: null, error: null })

      const result = await updateSettings(buildSettingsInput())

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

      const result = await updateSettings(buildSettingsInput())

      expect(result).toEqual({ error: 'Update failed' })
    })

    it('includes maxMediaPerReport in update call', async () => {
      setupAdmin()
      methods.single.mockResolvedValueOnce({
        data: { id: 'settings-1' },
        error: null,
      })

      await updateSettings(buildSettingsInput({ maxMediaPerReport: 15 }))

      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({ max_media_per_report: 15 })
      )
    })

    describe('input validation', () => {
      it('rejects maxMediaPerReport below the allowed range', async () => {
        const result = await updateSettings(buildSettingsInput({ maxMediaPerReport: 0 }))
        expect(result).toEqual({
          error: expect.stringContaining('Max media per report must be an integer between 1 and 50'),
        })
        expect(methods.update).not.toHaveBeenCalled()
      })

      it('rejects maxMediaPerReport above the allowed range', async () => {
        const result = await updateSettings(buildSettingsInput({ maxMediaPerReport: 51 }))
        expect(result).toEqual({
          error: expect.stringContaining('Max media per report must be an integer between 1 and 50'),
        })
        expect(methods.update).not.toHaveBeenCalled()
      })

      it('rejects non-integer maxMediaPerReport', async () => {
        const result = await updateSettings(buildSettingsInput({ maxMediaPerReport: 5.5 }))
        expect(result).toEqual({
          error: expect.stringContaining('Max media per report must be an integer between 1 and 50'),
        })
        expect(methods.update).not.toHaveBeenCalled()
      })

      it('rejects NaN maxMediaPerReport (e.g. parseInt of empty input)', async () => {
        const result = await updateSettings(buildSettingsInput({ maxMediaPerReport: Number.NaN }))
        expect(result).toEqual({
          error: expect.stringContaining('Max media per report must be an integer between 1 and 50'),
        })
      })

      it('rejects highParticipationThreshold out of range', async () => {
        const result = await updateSettings(buildSettingsInput({ highParticipationThreshold: 101 }))

        expect(result).toEqual({
          error: expect.stringContaining('High participation threshold must be an integer between 1 and 100 participations'),
        })
        expect(methods.update).not.toHaveBeenCalled()
      })

      it('rejects NaN highParticipationThreshold', async () => {
        const result = await updateSettings(buildSettingsInput({ highParticipationThreshold: Number.NaN }))

        expect(result).toEqual({
          error: expect.stringContaining('High participation threshold must be an integer between 1 and 100 participations'),
        })
      })

      it('rejects requiredWalksPerRound out of range', async () => {
        const result = await updateSettings(buildSettingsInput({ requiredWalksPerRound: 0 }))
        expect(result).toEqual({
          error: expect.stringContaining('Required walks per round must be an integer between 1 and 20'),
        })
      })

      it('rejects reminderWindowLengthDays out of range', async () => {
        const result = await updateSettings(buildSettingsInput({ reminderWindowLengthDays: 31 }))
        expect(result).toEqual({
          error: expect.stringContaining('Reminder window length must be an integer between 1 and 30 days'),
        })
      })

      it('reports multiple validation errors joined together', async () => {
        const result = await updateSettings(buildSettingsInput({
          requiredWalksPerRound: 0,
          highParticipationThreshold: 0,
          maxMediaPerReport: 0,
          reminderWindowLengthDays: 0,
        }))
        expect(result.error).toContain('Required walks per round must be an integer between 1 and 20')
        expect(result.error).toContain('Max media per report must be an integer between 1 and 50')
        expect(result.error).toContain('High participation threshold must be an integer between 1 and 100 participations')
        expect(result.error).toContain('Reminder window length must be an integer between 1 and 30 days')
      })

      it('does not call requireAdmin/db when validation fails', async () => {
        await updateSettings(buildSettingsInput({ requiredWalksPerRound: 0 }))
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

        const result = await updateSettings(buildSettingsInput({
          requiredWalksPerRound: 1,
          highParticipationThreshold: 1,
          maxMediaPerReport: 1,
          reminderSendWeekday: 0,
          reminderWindowStartOffsetDays: 0,
          reminderWindowLengthDays: 1,
        }))

        expect(result).toEqual({ success: true })
      })

      it('accepts boundary values: max', async () => {
        setupAdmin()
        methods.single.mockResolvedValueOnce({
          data: { id: 'settings-1' },
          error: null,
        })

        const result = await updateSettings(buildSettingsInput({
          requiredWalksPerRound: 20,
          highParticipationThreshold: 100,
          maxMediaPerReport: 50,
          reminderSendWeekday: 6,
          reminderWindowStartOffsetDays: 30,
          reminderWindowLengthDays: 30,
        }))

        expect(result).toEqual({ success: true })
      })
    })
  })

  describe('updateRound', () => {
    it('updates a round and revalidates', async () => {
      setupAdmin()
      methods.then.mockImplementationOnce((resolve: (value: unknown) => unknown) =>
        Promise.resolve(resolve({ data: [], error: null, count: null }))
      )

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
      methods.then.mockImplementationOnce((resolve: (value: unknown) => unknown) =>
        Promise.resolve(resolve({ data: [], error: null, count: null }))
      )
      methods.eq
        .mockReturnValueOnce(methods)
        .mockReturnValueOnce({ error: { message: 'Update failed' } })

      const result = await updateRound('round-1', roundData)

      expect(result).toEqual({ error: 'Update failed' })
    })

    it('rejects overlap with another round during updates', async () => {
      setupAdmin()
      methods.then.mockImplementationOnce((resolve: (value: unknown) => unknown) =>
        Promise.resolve(resolve({
          data: [
            { id: 'round-1', name: 'Round 1', start_date: '2026-04-01', end_date: '2026-04-30' },
            { id: 'round-2', name: 'Round 2', start_date: '2026-05-01', end_date: '2026-05-31' },
          ],
          error: null,
          count: null,
        }))
      )

      const result = await updateRound('round-1', {
        ...roundData,
        startDate: '2026-04-20',
        endDate: '2026-05-10',
      })

      expect(result).toEqual({
        error: 'Round dates overlap with Round 2 (2026-05-01 to 2026-05-31). Rounds must not overlap.',
      })
      expect(methods.update).not.toHaveBeenCalled()
    })
  })

  describe('updateWalk', () => {
    it('updates a slot and revalidates', async () => {
      setupAdmin()
      mockExistingWalk()
      mockRoundDateRange()

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
        maxVolunteers: 4,
      })
      expect(result).toEqual({ error: expect.stringContaining('Max volunteers must be between 1 and 3') })
    })

    it('returns error on DB failure', async () => {
      setupAdmin()
      mockExistingWalk()
      mockRoundDateRange()
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'walk_slots') {
          return {
            ...methods,
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: { message: 'Update failed' } }),
            }),
          }
        }
        return methods
      })

      const result = await updateWalk('slot-1', walkData)

      expect(result).toEqual({ error: 'Update failed' })
    })

    it('returns error when updated walk date is outside the selected round', async () => {
      setupAdmin()
      mockExistingWalk()
      mockRoundDateRange()

      const result = await updateWalk('slot-1', {
        ...walkData,
        walkDate: '2026-03-31',
      })

      expect(result).toEqual({
        error: 'Walk date 2026-03-31 must be between the round start date (2026-04-01) and end date (2026-04-30).',
      })
      expect(methods.update).not.toHaveBeenCalled()
    })

    it('blocks date/time changes after reminder emails have been sent', async () => {
      setupAdmin()
      mockExistingWalk({ reminder_sent_at: '2026-04-09T05:00:00.000Z' })

      const result = await updateWalk('slot-1', {
        ...walkData,
        startTime: '09:00',
      })

      expect(result).toEqual({
        error: 'Walk date and start time cannot be changed after reminder emails have been sent.',
      })
    })
  })

  describe('bulkCreateWalks', () => {
    it('invokes edge function and revalidates', async () => {
      setupAdmin()
      mockRoundDateRange()
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

    it('returns error when a bulk slot exceeds the volunteer cap', async () => {
      const result = await bulkCreateWalks({
        roundId: 'round-1',
        slots: [
          { locationName: 'Park A', walkDate: '2026-04-15', startTime: '08:00', endTime: '10:00', maxVolunteers: 4 },
        ],
      })

      expect(result).toEqual({ error: expect.stringContaining('Walk 1:') })
      expect(result).toEqual({ error: expect.stringContaining('Max volunteers must be between 1 and 3') })
    })

    it('returns error on edge function failure', async () => {
      setupAdmin()
      mockRoundDateRange()
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

    it('returns error when a bulk walk date is outside the round', async () => {
      setupAdmin()
      mockRoundDateRange()

      const result = await bulkCreateWalks({
        roundId: 'round-1',
        slots: [
          { locationName: 'Park A', walkDate: '2026-04-15', startTime: '08:00', endTime: '10:00' },
          { locationName: 'Park B', walkDate: '2026-05-01', startTime: '09:00', endTime: '11:00' },
        ],
      })

      expect(result).toEqual({
        error: 'Walk date 2026-05-01 must be between the round start date (2026-04-01) and end date (2026-04-30).',
      })
      expect(mockSupabase.functions.invoke).not.toHaveBeenCalled()
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
      expect(result).toEqual({ error: expect.stringContaining('Max volunteers must be between 1 and 3') })
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
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'incidents') {
          return {
            ...methods,
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: { message: 'Resolve failed' } }),
            }),
          }
        }
        return methods
      })

      const result = await resolveIncident('incident-1', 'Notes')

      expect(result).toEqual({ error: 'Resolve failed' })
    })
  })
})
