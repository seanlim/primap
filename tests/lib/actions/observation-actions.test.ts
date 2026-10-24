import { revalidatePath } from 'next/cache'

const { mockSupabase, methods, mockStorage, adminStorage } = vi.hoisted(() => {
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
  const adminStorage = { remove: vi.fn().mockResolvedValue({ error: null }) }
  const mockSupabase = {
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn().mockReturnValue(methods),
    storage: {
      from: vi.fn().mockReturnValue(mockStorage),
    },
  }
  return { mockSupabase, methods, mockStorage, adminStorage }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ storage: { from: vi.fn(() => adminStorage) } })),
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
    vi.resetAllMocks()
    mockSupabase.from.mockReturnValue(methods)
    mockSupabase.storage.from.mockReturnValue(mockStorage)
    mockSupabase.rpc.mockResolvedValue({ data: { success: true, file_paths: [] }, error: null })
    adminStorage.remove.mockResolvedValue({ error: null })
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
      // update().eq().eq() — second eq returns error
      methods.eq
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
      // For the update (2 eq calls), then sightings select (1 eq call)
      methods.eq
        .mockReturnValueOnce(methods) // update eq('id', obsId)
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
      // update chain (2 eq), then sightings select (1 eq)
      methods.eq
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

  describe('submitObservation', () => {
    const observationId = '22222222-2222-4222-8222-222222222222'
    const uploaderId = '11111111-1111-4111-8111-111111111111'
    const walkId = '33333333-3333-4333-8333-333333333333'
    const path = `${uploaderId}/${observationId}/photo.jpg`

    it('does not submit when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })
      expect(await submitObservation(observationId, walkId)).toEqual({ error: 'Not authenticated' })
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
      expect(adminStorage.remove).not.toHaveBeenCalled()
    })

    it('delegates submission to the authenticated RPC', async () => {
      setupUser()
      expect(await submitObservation(observationId, walkId)).toEqual({ success: true })
      expect(mockSupabase.rpc).toHaveBeenCalledWith('submit_observation_with_cleanup', {
        p_observation_id: observationId, p_walk_id: walkId,
      })
      expect(mockSupabase.from).not.toHaveBeenCalled()
      expect(adminStorage.remove).not.toHaveBeenCalled()
      for (const route of ['/report', `/report/${walkId}`, '/home', '/profile']) {
        expect(revalidatePath).toHaveBeenCalledWith(route)
      }
    })

    it('preserves storage when the database submission fails', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'Submission rolled back' } })
      expect(await submitObservation(observationId, walkId)).toEqual({ error: 'Submission rolled back' })
      expect(adminStorage.remove).not.toHaveBeenCalled()
      expect(mockStorage.remove).not.toHaveBeenCalled()
      expect(revalidatePath).not.toHaveBeenCalled()
    })

    it('preserves storage when the RPC rejects authorization or validation', async () => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({ data: { error: 'Not actively joined', file_paths: [path] }, error: null })
      expect(await submitObservation(observationId, walkId)).toEqual({ error: 'Not actively joined' })
      expect(adminStorage.remove).not.toHaveBeenCalled()
    })

    it.each([null, [], 'success', {}, { success: false }].map(data => ({ data })))('rejects invalid RPC response %j', async ({ data }) => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({ data, error: null })
      expect(await submitObservation(observationId, walkId)).toEqual({ error: 'Failed to submit observation.' })
      expect(adminStorage.remove).not.toHaveBeenCalled()
    })

    it('waits for successful submission before removing another member’s observation files', async () => {
      setupUser('another-member')
      let resolve!: (value: unknown) => void
      mockSupabase.rpc.mockReturnValue(new Promise(r => { resolve = r }))
      const submission = submitObservation(observationId, walkId)
      await Promise.resolve()
      expect(adminStorage.remove).not.toHaveBeenCalled()
      resolve({ data: { success: true, file_paths: [path] }, error: null })
      expect(await submission).toEqual({ success: true })
      expect(adminStorage.remove).toHaveBeenCalledWith([path])
      expect(mockStorage.remove).not.toHaveBeenCalled()
    })

    it.each([
      `${uploaderId}/44444444-4444-4444-8444-444444444444/photo.jpg`,
      `${uploaderId}/${observationId}/../photo.jpg`,
      `${uploaderId}/${observationId}/..`,
      `${uploaderId}/${observationId}/`,
      `${uploaderId}/${observationId}/nested/photo.jpg`,
      `${uploaderId}/${observationId}/back\\slash.jpg`,
      `invalid-uploader/${observationId}/photo.jpg`,
      42,
      null,
    ])('never passes an unsafe cleanup path to the service role: %j', async unsafePath => {
      setupUser()
      mockSupabase.rpc.mockResolvedValue({ data: { success: true, file_paths: [unsafePath, path] }, error: null })
      expect(await submitObservation(observationId, walkId)).toEqual({ success: true })
      expect(adminStorage.remove).toHaveBeenCalledWith([path])
    })

    it.each([{ error: { message: 'Storage unavailable' } }, new Error('Network unavailable')])(
      'keeps submission successful when post-commit storage cleanup fails: %j', async failure => {
        setupUser()
        mockSupabase.rpc.mockResolvedValue({ data: { success: true, file_paths: [path] }, error: null })
        if (failure instanceof Error) adminStorage.remove.mockRejectedValue(failure)
        else adminStorage.remove.mockResolvedValue(failure)
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        try {
          expect(await submitObservation(observationId, walkId)).toEqual({ success: true })
          expect(revalidatePath).toHaveBeenCalledWith('/report')
          expect(log).toHaveBeenCalled()
        } finally {
          log.mockRestore()
        }
      }
    )
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

    it('returns error on DB delete failure and does NOT remove storage object', async () => {
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
      // The storage file must NOT be removed when the DB delete fails —
      // otherwise a resolved-incident RLS denial would destroy evidence
      // while leaving a dangling media row with a broken gallery tile.
      expect(mockStorage.remove).not.toHaveBeenCalled()
    })

    it('still removes storage object after successful DB delete', async () => {
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
      // DB delete succeeds → storage cleanup fires after.
      expect(methods.delete).toHaveBeenCalled()
      expect(mockStorage.remove).toHaveBeenCalledWith(['user-1/obs-1/file.jpg'])
    })
  })
})
