import { revalidatePath } from 'next/cache'

const { mockSupabase, methods, mockStorage } = vi.hoisted(() => {
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
  const mockStorage = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn().mockReturnValue({
      data: { publicUrl: 'https://example.com/public/file.jpg' },
    }),
  }
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn().mockReturnValue(methods),
    storage: {
      from: vi.fn().mockReturnValue(mockStorage),
    },
  }
  return { mockSupabase, methods, mockStorage }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

import {
  saveDraft,
  submitObservation,
  deleteMedia,
} from '@/lib/actions/observation-actions'

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
  mockStorage.upload.mockResolvedValue({ error: null })
  mockStorage.remove.mockResolvedValue({ error: null })
}

function setupUser(userId = 'user-1') {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
  })
}

const baseDraftInput = {
  walkId: 'slot-1',
  walkCompletion: 'COMPLETED' as const,
  outcome: 'NOT_SIGHTED' as const,
  notes: 'All clear',
  lat: 1.35,
  lng: 103.82,
}

const sightingInput = {
  species: 'RBL' as const,
  count: '3',
  lat: 1.36,
  lng: 103.83,
  notes: 'Near trail',
}

const otherSightingInput = {
  species: 'OTHER' as const,
  species_other: 'Silvered Langur',
  count: '2',
  lat: 1.37,
  lng: 103.84,
  notes: 'Unusual species',
}

describe('observation-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
  })

  // ─── saveDraft ───────────────────────────────────────────────────────

  describe('saveDraft', () => {
    it('returns error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await saveDraft(baseDraftInput)

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('creates new draft when no observationId', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      const result = await saveDraft(baseDraftInput)

      expect(result).toEqual(expect.objectContaining({
        success: true,
        observationId: 'obs-1',
        sightingIds: [],
      }))
      expect(mockSupabase.from).toHaveBeenCalledWith('observations')
      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          slot_id: 'slot-1',
          user_id: 'user-1',
          status: 'DRAFT',
        })
      )
      expect(revalidatePath).toHaveBeenCalledWith('/report')
    })

    it('returns error on 23505 unique violation for new draft', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'unique violation' },
      })

      const result = await saveDraft(baseDraftInput)

      expect(result).toEqual({
        error: 'You already have a report for this walk.',
      })
    })

    it('returns other DB error for new draft', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'XXXXX', message: 'Something went wrong' },
      })

      const result = await saveDraft(baseDraftInput)

      expect(result).toEqual({ error: 'Something went wrong' })
    })

    it('updates existing draft when observationId is provided', async () => {
      setupUser()

      const result = await saveDraft({
        ...baseDraftInput,
        observationId: 'obs-1',
      })

      expect(result).toEqual(expect.objectContaining({
        success: true,
        observationId: 'obs-1',
        sightingIds: [],
      }))
      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({
          walk_completion: 'COMPLETED',
          outcome: 'NOT_SIGHTED',
        })
      )
    })

    it('returns error when updating existing draft fails', async () => {
      setupUser()
      // update().eq().eq().eq() — third eq returns error
      methods.eq
        .mockReturnValueOnce(methods)
        .mockReturnValueOnce(methods)
        .mockReturnValueOnce({ error: { message: 'Update failed' } })

      const result = await saveDraft({
        ...baseDraftInput,
        observationId: 'obs-1',
      })

      expect(result).toEqual({ error: 'Update failed' })
    })

    it('derives outcome as NOT_SIGHTED when input says NOT_SIGHTED', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: { id: 'obs-1' },
        error: null,
      })

      const result = await saveDraft({
        ...baseDraftInput,
        outcome: 'NOT_SIGHTED',
        sightings: [],
      })

      expect(result).toEqual(expect.objectContaining({ success: true }))
      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'NOT_SIGHTED' })
      )
    })

    it('updates existing sighting (has s.id) and inserts new sighting (no s.id)', async () => {
      setupUser()
      // New sighting insert: insert().select('id').single()
      methods.single.mockResolvedValueOnce({
        data: { id: 'new-sight-1' },
        error: null,
      })

      const result = await saveDraft({
        ...baseDraftInput,
        observationId: 'obs-1',
        sightings: [
          { ...sightingInput, id: 'existing-sight' },
          { ...sightingInput },
        ],
      })

      expect(result).toEqual(expect.objectContaining({
        success: true,
        observationId: 'obs-1',
        sightingIds: ['existing-sight', 'new-sight-1'],
      }))
    })

    it('removes sightings no longer in form', async () => {
      setupUser()
      // For the update (3 eq calls), then sightings select (1 eq call)
      methods.eq
        .mockReturnValueOnce(methods) // update eq('id', obsId)
        .mockReturnValueOnce(methods) // update eq('user_id', userId)
        .mockReturnValueOnce(methods) // update eq('status', 'DRAFT')
        .mockReturnValueOnce({ data: [{ id: 'old-sight-1' }] }) // sightings select eq

      // New sighting insert
      methods.single.mockResolvedValueOnce({
        data: { id: 'new-sight-1' },
        error: null,
      })

      const result = await saveDraft({
        ...baseDraftInput,
        observationId: 'obs-1',
        sightings: [{ ...sightingInput }],
      })

      expect(result).toEqual(expect.objectContaining({
        success: true,
        observationId: 'obs-1',
        sightingIds: ['new-sight-1'],
      }))
      expect(methods.delete).toHaveBeenCalled()
      expect(methods.in).toHaveBeenCalledWith('id', ['old-sight-1'])
    })

    it('removes all existing sightings when no sightings in form', async () => {
      setupUser()
      // update chain (3 eq), then sightings select (1 eq)
      methods.eq
        .mockReturnValueOnce(methods)
        .mockReturnValueOnce(methods)
        .mockReturnValueOnce(methods)
        .mockReturnValueOnce({ data: [{ id: 'sight-a' }, { id: 'sight-b' }] })

      const result = await saveDraft({
        ...baseDraftInput,
        observationId: 'obs-1',
        sightings: [],
      })

      expect(result).toEqual(expect.objectContaining({
        success: true,
        observationId: 'obs-1',
        sightingIds: [],
      }))
      expect(methods.in).toHaveBeenCalledWith('id', ['sight-a', 'sight-b'])
    })

    it('removes all existing sightings with media cleanup when no sightings in form and existing have media', async () => {
      setupUser()

      // Track from() calls to return different chains
      let fromCallCount = 0
      mockSupabase.from.mockImplementation(() => {
        fromCallCount++
        // Call 1: observations update
        // Call 2: sightings select (existing sightings)
        // Call 3: media select (for cleanup)
        // Call 4: sightings delete
        if (fromCallCount === 2) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ id: 'sight-x' }] }),
            }),
          }
        }
        if (fromCallCount === 3) {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [{ file_path: 'path/to/media.jpg' }] }),
            }),
          }
        }
        return methods
      })

      const result = await saveDraft({
        ...baseDraftInput,
        observationId: 'obs-1',
        sightings: [],
      })

      expect(result).toEqual(expect.objectContaining({ success: true }))
      expect(mockStorage.remove).toHaveBeenCalledWith(['path/to/media.jpg'])

      // Reset from mock
      mockSupabase.from.mockReturnValue(methods)
    })

    it('handles new sighting insert returning null', async () => {
      setupUser()
      methods.single
        .mockResolvedValueOnce({ data: { id: 'obs-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null })

      const result = await saveDraft({
        ...baseDraftInput,
        sightings: [sightingInput],
      })

      expect(result).toEqual(expect.objectContaining({
        success: true,
        observationId: 'obs-1',
        sightingIds: [],
      }))
    })

    // ─── species_other tests ────────────────────────────────────────────

    it('includes species_other when inserting a new OTHER sighting', async () => {
      setupUser()
      methods.single
        .mockResolvedValueOnce({ data: { id: 'obs-1' }, error: null }) // observation insert
        .mockResolvedValueOnce({ data: { id: 'sight-other-1' }, error: null }) // sighting insert

      const result = await saveDraft({
        ...baseDraftInput,
        outcome: 'SIGHTED',
        sightings: [otherSightingInput],
      })

      expect(result).toEqual(expect.objectContaining({
        success: true,
        sightingIds: ['sight-other-1'],
      }))
      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          species: 'OTHER',
          species_other: 'Silvered Langur',
        })
      )
    })

    it('includes species_other when updating an existing OTHER sighting', async () => {
      setupUser()

      const result = await saveDraft({
        ...baseDraftInput,
        observationId: 'obs-1',
        outcome: 'SIGHTED',
        sightings: [{ ...otherSightingInput, id: 'existing-sight' }],
      })

      expect(result).toEqual(expect.objectContaining({ success: true }))
      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({
          species: 'OTHER',
          species_other: 'Silvered Langur',
        })
      )
    })

    it('sets species_other to null for non-OTHER species insert', async () => {
      setupUser()
      methods.single
        .mockResolvedValueOnce({ data: { id: 'obs-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'sight-1' }, error: null })

      await saveDraft({
        ...baseDraftInput,
        outcome: 'SIGHTED',
        sightings: [sightingInput],
      })

      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          species: 'RBL',
          species_other: null,
        })
      )
    })

    it('sets species_other to null for non-OTHER species update', async () => {
      setupUser()

      await saveDraft({
        ...baseDraftInput,
        observationId: 'obs-1',
        outcome: 'SIGHTED',
        sightings: [{ ...sightingInput, id: 'existing-sight' }],
      })

      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({
          species: 'RBL',
          species_other: null,
        })
      )
    })

    it('handles mixed sightings: one RBL and one OTHER', async () => {
      setupUser()
      methods.single
        .mockResolvedValueOnce({ data: { id: 'obs-1' }, error: null }) // observation insert
        .mockResolvedValueOnce({ data: { id: 'sight-rbl' }, error: null }) // RBL sighting insert
        .mockResolvedValueOnce({ data: { id: 'sight-other' }, error: null }) // OTHER sighting insert

      const result = await saveDraft({
        ...baseDraftInput,
        outcome: 'SIGHTED',
        sightings: [
          sightingInput,
          otherSightingInput,
        ],
      })

      expect(result).toEqual(expect.objectContaining({
        success: true,
        sightingIds: ['sight-rbl', 'sight-other'],
      }))
    })

    it('saves species_other as null when species_other is empty string', async () => {
      setupUser()
      methods.single
        .mockResolvedValueOnce({ data: { id: 'obs-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'sight-1' }, error: null })

      await saveDraft({
        ...baseDraftInput,
        outcome: 'SIGHTED',
        sightings: [{ ...otherSightingInput, species_other: '' }],
      })

      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          species: 'OTHER',
          species_other: null,
        })
      )
    })

    it('saves species_other as null when species_other is undefined', async () => {
      setupUser()
      methods.single
        .mockResolvedValueOnce({ data: { id: 'obs-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'sight-1' }, error: null })

      await saveDraft({
        ...baseDraftInput,
        outcome: 'SIGHTED',
        sightings: [{ ...otherSightingInput, species_other: undefined }],
      })

      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          species: 'OTHER',
          species_other: null,
        })
      )
    })
  })

  // ─── submitObservation ───────────────────────────────────────────────

  describe('submitObservation', () => {
    it('returns error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when observation not found', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({ data: null, error: null })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({
        error: 'Observation not found or already submitted.',
      })
    })

    // TC-UNIT-OBS-03 (UC-06 A2): Missing completion status is blocked
    it('returns error when walk_completion is missing', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: null,
          outcome: 'SIGHTED',
          sightings: [{ lat: 1, lng: 2 }],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({ error: 'Walk completion is required.' })
    })

    // TC-UNIT-OBS-04 (UC-06 A2): Missing outcome is blocked
    it('returns error when outcome is missing', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: null,
          sightings: [],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({ error: 'Outcome is required.' })
    })

    it('returns error when SIGHTED with no sightings', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          sightings: [],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({
        error: 'At least one sighting is required when outcome is Sighted.',
      })
    })

    it('returns error when SIGHTED sighting missing lat', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          sightings: [{ lat: null, lng: 103.82 }],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({
        error: 'GPS location is required for each sighting.',
      })
    })

    it('returns error when SIGHTED sighting missing lng', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          sightings: [{ lat: 1.35, lng: null }],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({
        error: 'GPS location is required for each sighting.',
      })
    })

    // TC-UNIT-OBS-01 (UC-06): Sighted submission succeeds with required fields
    it('submits SIGHTED observation successfully', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          lat: 1.35,
          lng: 103.82,
          sightings: [{ lat: 1.36, lng: 103.83 }],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({ success: true })
      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SUBMITTED', lat: null, lng: null })
      )
      expect(revalidatePath).toHaveBeenCalledWith('/report')
      expect(revalidatePath).toHaveBeenCalledWith('/report/slot-1')
      expect(revalidatePath).toHaveBeenCalledWith('/home')
      expect(revalidatePath).toHaveBeenCalledWith('/profile')
    })

    it('returns error when NOT_SIGHTED without obs lat/lng', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'NOT_SIGHTED',
          lat: null,
          lng: null,
          sightings: [],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({
        error: 'GPS location is required for Not Sighted reports.',
      })
    })

    // TC-UNIT-OBS-02 (UC-06): Not-sighted submission succeeds with required fields
    it('submits NOT_SIGHTED observation successfully', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'NOT_SIGHTED',
          lat: 1.35,
          lng: 103.82,
          sightings: [],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({ success: true })
    })

    // ─── OTHER species validation ───────────────────────────────────────

    it('returns error when SIGHTED with OTHER species and null species_other', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          sightings: [{ lat: 1.36, lng: 103.83, species: 'OTHER', species_other: null }],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({
        error: 'Species name is required when "Other" is selected.',
      })
    })

    it('returns error when SIGHTED with OTHER species and empty species_other', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          sightings: [{ lat: 1.36, lng: 103.83, species: 'OTHER', species_other: '' }],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({
        error: 'Species name is required when "Other" is selected.',
      })
    })

    it('returns error when SIGHTED with OTHER species and whitespace-only species_other', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          sightings: [{ lat: 1.36, lng: 103.83, species: 'OTHER', species_other: '   ' }],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({
        error: 'Species name is required when "Other" is selected.',
      })
    })

    it('succeeds when SIGHTED with OTHER species and valid species_other', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          sightings: [{ lat: 1.36, lng: 103.83, species: 'OTHER', species_other: 'Silvered Langur' }],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({ success: true })
    })

    it('validates OTHER species_other even when mixed with non-OTHER sightings', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          sightings: [
            { lat: 1.36, lng: 103.83, species: 'RBL', species_other: null },
            { lat: 1.37, lng: 103.84, species: 'OTHER', species_other: null },
          ],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({
        error: 'Species name is required when "Other" is selected.',
      })
    })

    it('succeeds with multiple sightings including valid OTHER', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          sightings: [
            { lat: 1.36, lng: 103.83, species: 'RBL', species_other: null },
            { lat: 1.37, lng: 103.84, species: 'OTHER', species_other: 'Silvered Langur' },
            { lat: 1.38, lng: 103.85, species: 'LTM', species_other: null },
          ],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({ success: true })
    })

    it('does not validate species_other for non-OTHER species (RBL with null species_other passes)', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          sightings: [{ lat: 1.36, lng: 103.83, species: 'RBL', species_other: null }],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({ success: true })
    })

    it('checks GPS before species_other (missing GPS error takes priority)', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          sightings: [{ lat: null, lng: 103.83, species: 'OTHER', species_other: null }],
        },
        error: null,
      })

      const result = await submitObservation('obs-1', 'slot-1')

      // GPS validation runs first in the loop
      expect(result).toEqual({
        error: 'GPS location is required for each sighting.',
      })
    })

    // ─── Nuke observation-level data for SIGHTED ─────────────────────────

    it('nulls lat/lng in update for SIGHTED submissions', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          lat: 1.35,
          lng: 103.82,
          sightings: [{ lat: 1.36, lng: 103.83, species: 'RBL', species_other: null }],
        },
        error: null,
      })

      await submitObservation('obs-1', 'slot-1')

      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({ lat: null, lng: null })
      )
    })

    it('does NOT null lat/lng for NOT_SIGHTED submissions', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'NOT_SIGHTED',
          lat: 1.35,
          lng: 103.82,
          sightings: [],
        },
        error: null,
      })

      await submitObservation('obs-1', 'slot-1')

      expect(methods.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SUBMITTED' })
      )
      expect(methods.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ lat: null })
      )
    })

    it('deletes observation-level media from storage and DB for SIGHTED', async () => {
      setupUser()

      let fromCallCount = 0
      mockSupabase.from.mockImplementation((table: string) => {
        fromCallCount++
        // Call 1: observations select (fetch observation with sightings)
        if (fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        walk_completion: 'COMPLETED',
                        outcome: 'SIGHTED',
                        lat: 1.35,
                        lng: 103.82,
                        sightings: [{ lat: 1.36, lng: 103.83, species: 'RBL', species_other: null }],
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        // Call 2: media select (observation-level media query)
        if (fromCallCount === 2 && table === 'media') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'media-1', file_path: 'user-1/obs-1/photo1.jpg' },
                  { id: 'media-2', file_path: 'user-1/obs-1/photo2.jpg' },
                ],
                error: null,
              }),
            }),
          }
        }
        // Call 3: media delete (delete obs-level media records)
        if (fromCallCount === 3 && table === 'media') {
          return {
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        // Call 4: observations update (status + nulling lat/lng)
        return methods
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('observation-media')
      expect(mockStorage.remove).toHaveBeenCalledWith([
        'user-1/obs-1/photo1.jpg',
        'user-1/obs-1/photo2.jpg',
      ])

      // Reset
      mockSupabase.from.mockReturnValue(methods)
    })

    it('does NOT delete media when SIGHTED but no observation-level media exists', async () => {
      setupUser()

      let fromCallCount = 0
      mockSupabase.from.mockImplementation((table: string) => {
        fromCallCount++
        if (fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        walk_completion: 'COMPLETED',
                        outcome: 'SIGHTED',
                        lat: null,
                        lng: null,
                        sightings: [{ lat: 1.36, lng: 103.83, species: 'LTM', species_other: null }],
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        // Call 2: media select returns empty
        if (fromCallCount === 2 && table === 'media') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }
        return methods
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({ success: true })
      // storage.remove should NOT be called since no media to delete
      expect(mockStorage.remove).not.toHaveBeenCalled()

      mockSupabase.from.mockReturnValue(methods)
    })

    it('does NOT query or delete observation-level media for NOT_SIGHTED', async () => {
      setupUser()

      const fromSpy = vi.fn()
      let fromCallCount = 0
      mockSupabase.from.mockImplementation((table: string) => {
        fromCallCount++
        fromSpy(table)
        if (fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        walk_completion: 'COMPLETED',
                        outcome: 'NOT_SIGHTED',
                        lat: 1.35,
                        lng: 103.82,
                        sightings: [],
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        return methods
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({ success: true })
      // For NOT_SIGHTED, the only from() calls should be observations (select + update), NOT media
      const mediaCalls = fromSpy.mock.calls.filter((c: string[]) => c[0] === 'media')
      expect(mediaCalls).toHaveLength(0)
      expect(mockStorage.remove).not.toHaveBeenCalled()

      mockSupabase.from.mockReturnValue(methods)
    })

    it('handles null data from media select for SIGHTED gracefully', async () => {
      setupUser()

      let fromCallCount = 0
      mockSupabase.from.mockImplementation((table: string) => {
        fromCallCount++
        if (fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        walk_completion: 'COMPLETED',
                        outcome: 'SIGHTED',
                        lat: 1.35,
                        lng: 103.82,
                        sightings: [{ lat: 1.36, lng: 103.83, species: 'DUSKY', species_other: null }],
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        // media select returns null data
        if (fromCallCount === 2 && table === 'media') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }
        }
        return methods
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({ success: true })
      expect(mockStorage.remove).not.toHaveBeenCalled()

      mockSupabase.from.mockReturnValue(methods)
    })

    it('nukes obs-level data with single media file for SIGHTED', async () => {
      setupUser()

      let fromCallCount = 0
      mockSupabase.from.mockImplementation((table: string) => {
        fromCallCount++
        if (fromCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        walk_completion: 'PARTIAL',
                        outcome: 'SIGHTED',
                        lat: 1.35,
                        lng: 103.82,
                        sightings: [{ lat: 1.36, lng: 103.83, species: 'RBL', species_other: null }],
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        if (fromCallCount === 2 && table === 'media') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'media-solo', file_path: 'user-1/obs-1/only.jpg' }],
                error: null,
              }),
            }),
          }
        }
        if (fromCallCount === 3 && table === 'media') {
          return {
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        return methods
      })

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({ success: true })
      expect(mockStorage.remove).toHaveBeenCalledWith(['user-1/obs-1/only.jpg'])

      mockSupabase.from.mockReturnValue(methods)
    })

    it('returns error on DB update failure', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          walk_completion: 'COMPLETED',
          outcome: 'SIGHTED',
          sightings: [{ lat: 1.36, lng: 103.83 }],
        },
        error: null,
      })
      // select chain: eq x3, then nuke media select: eq x1, then update chain: eq x2
      methods.eq
        .mockReturnValueOnce(methods) // select eq('id', obsId)
        .mockReturnValueOnce(methods) // select eq('user_id', userId)
        .mockReturnValueOnce(methods) // select eq('status', 'DRAFT')
        .mockReturnValueOnce({ data: null, error: null }) // nuke: media select eq('observation_id', obsId)
        .mockReturnValueOnce(methods) // update eq('id', obsId)
        .mockReturnValueOnce({ error: { message: 'Submit failed' } }) // update eq('user_id', userId)

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({ error: 'Submit failed' })
    })
  })

  // ─── deleteMedia ─────────────────────────────────────────────────────

  describe('deleteMedia', () => {
    it('returns error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await deleteMedia('media-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when media not found', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({ data: null, error: null })

      const result = await deleteMedia('media-1')

      expect(result).toEqual({ error: 'Media not found' })
    })

    it('deletes observation media from observation-media bucket', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          file_path: 'user-1/obs-1/file.jpg',
          observation_id: 'obs-1',
          sighting_id: null,
          incident_id: null,
        },
        error: null,
      })

      const result = await deleteMedia('media-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('observation-media')
      expect(mockStorage.remove).toHaveBeenCalledWith(['user-1/obs-1/file.jpg'])
      expect(mockSupabase.from).toHaveBeenCalledWith('media')
      expect(methods.delete).toHaveBeenCalled()
    })

    it('deletes sighting media from observation-media bucket', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          file_path: 'user-1/sight-1/file.jpg',
          observation_id: null,
          sighting_id: 'sight-1',
          incident_id: null,
        },
        error: null,
      })

      const result = await deleteMedia('media-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('observation-media')
      expect(mockSupabase.storage.from).not.toHaveBeenCalledWith('incident-media')
    })

    it('deletes incident media from incident-media bucket', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          file_path: 'user-1/inc-1/file.jpg',
          observation_id: null,
          sighting_id: null,
          incident_id: 'inc-1',
        },
        error: null,
      })

      const result = await deleteMedia('media-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('incident-media')
      expect(mockSupabase.storage.from).not.toHaveBeenCalledWith('observation-media')
      expect(mockStorage.remove).toHaveBeenCalledWith(['user-1/inc-1/file.jpg'])
    })

    it('returns error on DB delete failure', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: {
          file_path: 'user-1/obs-1/file.jpg',
          observation_id: 'obs-1',
          sighting_id: null,
          incident_id: null,
        },
        error: null,
      })
      // select().eq().single() uses 1 eq, delete().eq() uses 1 eq
      methods.eq
        .mockReturnValueOnce(methods) // select eq('id', mediaId)
        .mockReturnValueOnce({ error: { message: 'Delete failed' } }) // delete eq

      const result = await deleteMedia('media-1')

      expect(result).toEqual({ error: 'Delete failed' })
    })
  })
})
