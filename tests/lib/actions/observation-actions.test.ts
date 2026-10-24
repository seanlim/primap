import { revalidatePath } from 'next/cache'

const { mockSupabase, methods, mockStorage, adminStorage, adminFrom, adminMethods, adminBucket } = vi.hoisted(() => {
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
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  for (const key of Object.keys(methods) as (keyof typeof methods)[]) {
    if (key !== 'single' && key !== 'maybeSingle') methods[key].mockReturnThis()
  }
  const mockStorage = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn().mockReturnValue({
      data: { publicUrl: 'https://example.com/public/file.jpg' },
    }),
  }
  const adminStorage = { remove: vi.fn().mockResolvedValue({ error: null }) }
  const adminMethods = {
    select: vi.fn(), delete: vi.fn(), eq: vi.fn(), in: vi.fn(),
  }
  const adminFrom = vi.fn(() => adminMethods)
  const adminBucket = vi.fn(() => adminStorage)
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
  return { mockSupabase, methods, mockStorage, adminStorage, adminFrom, adminMethods, adminBucket }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: adminFrom, storage: { from: adminBucket } })),
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
  methods.maybeSingle.mockResolvedValue({ data: null, error: null })
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
    adminFrom.mockReturnValue(adminMethods)
    for (const method of Object.values(adminMethods)) method.mockReturnValue(adminMethods)
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
    const draft = {
      id: observationId, slot_id: walkId, status: 'DRAFT',
      walk_completion: 'COMPLETED', outcome: 'SIGHTED',
      lat: 1.35, lng: 103.82, updated_at: '2026-10-24T12:00:00Z',
      sightings: [{ species: 'RBL', species_other: null, lat: 1.36, lng: 103.83 }],
    }

    beforeEach(() => {
      setupUser()
      methods.single.mockResolvedValue({ data: draft, error: null })
      methods.maybeSingle.mockResolvedValue({ data: { id: observationId }, error: null })
      adminMethods.select.mockResolvedValue({ data: [], error: null })
      adminMethods.in.mockResolvedValue({ data: [], error: null })
    })

    function withMedia(paths: string[] = [path]) {
      adminMethods.select
        .mockResolvedValueOnce({ data: paths.map(file_path => ({ file_path })), error: null })
        .mockReturnValueOnce(adminMethods)
    }

    it('does not submit when unauthenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })
      expect(await submitObservation(observationId, walkId)).toEqual({ error: 'Not authenticated' })
      expect(mockSupabase.from).not.toHaveBeenCalled()
      expect(adminFrom).not.toHaveBeenCalled()
    })

    it('uses an authenticated, scoped draft update instead of the RPC', async () => {
      expect(await submitObservation(observationId, walkId)).toEqual({ success: true })
      expect(mockSupabase.rpc).not.toHaveBeenCalled()
      expect(methods.eq).toHaveBeenCalledWith('id', observationId)
      expect(methods.eq).toHaveBeenCalledWith('slot_id', walkId)
      expect(methods.eq).toHaveBeenCalledWith('status', 'DRAFT')
      expect(methods.eq).toHaveBeenCalledWith('updated_at', draft.updated_at)
      expect(methods.update).toHaveBeenCalledWith({
        status: 'SUBMITTED', submitted_at: expect.any(String), lat: null, lng: null,
      })
      for (const route of ['/report', `/report/${walkId}`, '/home', '/profile']) {
        expect(revalidatePath).toHaveBeenCalledWith(route)
      }
    })

    it('does not elevate privileges when RLS hides the draft or the walk ID is wrong', async () => {
      methods.single.mockResolvedValue({ data: null, error: null })
      expect(await submitObservation(observationId, walkId)).toHaveProperty('error')
      expect(methods.update).not.toHaveBeenCalled()
      expect(adminFrom).not.toHaveBeenCalled()
    })

    it('preserves media when the authenticated update fails', async () => {
      methods.maybeSingle.mockResolvedValue({ data: null, error: { message: 'RLS rejected submission' } })
      expect(await submitObservation(observationId, walkId)).toEqual({ error: 'RLS rejected submission' })
      expect(adminFrom).not.toHaveBeenCalled()
      expect(adminStorage.remove).not.toHaveBeenCalled()
      expect(revalidatePath).not.toHaveBeenCalled()
    })

    it('does not clean up when the draft was changed, submitted or membership was revoked concurrently', async () => {
      methods.maybeSingle.mockResolvedValue({ data: null, error: null })
      expect(await submitObservation(observationId, walkId)).toHaveProperty('error')
      expect(adminFrom).not.toHaveBeenCalled()
      expect(adminStorage.remove).not.toHaveBeenCalled()
    })

    it.each([
      [{ walk_completion: null }, 'Walk completion is required.'],
      [{ outcome: null }, 'Outcome is required.'],
      [{ sightings: [] }, 'At least one sighting is required when outcome is Sighted.'],
      [{ sightings: [{ lat: 0, lng: 1 }] }, 'GPS location is required for each sighting.'],
      [{ sightings: [{ lat: 1, lng: null }] }, 'GPS location is required for each sighting.'],
      [{ outcome: 'NOT_SIGHTED', lat: null }, 'GPS location is required for Not Sighted reports.'],
      [{ outcome: 'NOT_SIGHTED', lng: 0 }, 'GPS location is required for Not Sighted reports.'],
    ])('validates the draft in TypeScript: %j', async (patch, error) => {
      methods.single.mockResolvedValue({ data: { ...draft, ...patch }, error: null })
      expect(await submitObservation(observationId, walkId)).toEqual({ error })
      expect(methods.update).not.toHaveBeenCalled()
      expect(adminFrom).not.toHaveBeenCalled()
    })

    it.each([null, '', ' ', '\t\n', '\u00a0', '\u2003', '\ufeff'])('rejects blank Other species names: %j', async name => {
      methods.single.mockResolvedValue({ data: {
        ...draft, sightings: [{ lat: 1, lng: 2, species: 'OTHER', species_other: name }],
      }, error: null })
      expect(await submitObservation(observationId, walkId)).toEqual({ error: 'Species name is required when "Other" is selected.' })
      expect(methods.update).not.toHaveBeenCalled()
    })

    it('accepts a named Other sighting', async () => {
      methods.single.mockResolvedValue({ data: {
        ...draft, sightings: [{ lat: 1, lng: 2, species: 'OTHER', species_other: ' Langur ' }],
      }, error: null })
      expect(await submitObservation(observationId, walkId)).toEqual({ success: true })
    })

    it('preserves not-sighted location and media', async () => {
      methods.single.mockResolvedValue({ data: { ...draft, outcome: 'NOT_SIGHTED' }, error: null })
      expect(await submitObservation(observationId, walkId)).toEqual({ success: true })
      expect(methods.update).toHaveBeenCalledWith({ status: 'SUBMITTED', submitted_at: expect.any(String) })
      expect(adminFrom).not.toHaveBeenCalled()
    })

    it('waits for a confirmed update before deleting another member’s observation media', async () => {
      withMedia()
      let resolve!: (value: unknown) => void
      methods.maybeSingle.mockReturnValue(new Promise(r => { resolve = r }))
      const submission = submitObservation(observationId, walkId)
      await Promise.resolve()
      await Promise.resolve()
      expect(adminFrom).not.toHaveBeenCalled()
      resolve({ data: { id: observationId }, error: null })
      expect(await submission).toEqual({ success: true })
      expect(adminMethods.delete).toHaveBeenCalled()
      expect(adminMethods.eq).toHaveBeenCalledWith('observation_id', observationId)
      expect(adminBucket).toHaveBeenCalledWith('observation-media')
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
    ])('never deletes an unsafe legacy path: %s', async unsafePath => {
      withMedia([unsafePath, path])
      expect(await submitObservation(observationId, walkId)).toEqual({ success: true })
      expect(adminStorage.remove).toHaveBeenCalledWith([path])
    })

    it('keeps files referenced by surviving media rows', async () => {
      withMedia()
      adminMethods.in.mockResolvedValue({ data: [{ file_path: path }], error: null })
      expect(await submitObservation(observationId, walkId)).toEqual({ success: true })
      expect(adminStorage.remove).not.toHaveBeenCalled()
    })

    it.each(['delete', 'references', 'storage'])('keeps submission successful after a %s cleanup failure', async stage => {
      withMedia()
      if (stage === 'delete') adminMethods.select.mockReset().mockResolvedValue({ data: null, error: { message: 'Delete failed' } })
      if (stage === 'references') adminMethods.in.mockResolvedValue({ data: null, error: { message: 'Reference check failed' } })
      if (stage === 'storage') adminStorage.remove.mockResolvedValue({ error: { message: 'Storage failed' } })
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        expect(await submitObservation(observationId, walkId)).toEqual({ success: true })
        expect(log).toHaveBeenCalled()
        if (stage !== 'storage') expect(adminStorage.remove).not.toHaveBeenCalled()
      } finally {
        log.mockRestore()
      }
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
