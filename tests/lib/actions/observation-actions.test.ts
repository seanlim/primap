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
  uploadMedia,
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

      expect(result).toEqual({
        success: true,
        observationId: 'obs-1',
        sightingIds: [],
      })
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

      expect(result).toEqual({
        success: true,
        observationId: 'obs-1',
        sightingIds: [],
      })
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

      expect(result).toEqual({
        success: true,
        observationId: 'obs-1',
        sightingIds: ['existing-sight', 'new-sight-1'],
      })
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

      expect(result).toEqual({
        success: true,
        observationId: 'obs-1',
        sightingIds: ['new-sight-1'],
      })
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

      expect(result).toEqual({
        success: true,
        observationId: 'obs-1',
        sightingIds: [],
      })
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

      expect(result).toEqual({
        success: true,
        observationId: 'obs-1',
        sightingIds: [],
      })
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
        expect.objectContaining({ status: 'SUBMITTED' })
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
      // select chain: eq x3, then update chain: eq x2
      methods.eq
        .mockReturnValueOnce(methods) // select eq('id', obsId)
        .mockReturnValueOnce(methods) // select eq('user_id', userId)
        .mockReturnValueOnce(methods) // select eq('status', 'DRAFT')
        .mockReturnValueOnce(methods) // update eq('id', obsId)
        .mockReturnValueOnce({ error: { message: 'Submit failed' } }) // update eq('user_id', userId)

      const result = await submitObservation('obs-1', 'slot-1')

      expect(result).toEqual({ error: 'Submit failed' })
    })
  })

  // ─── uploadMedia ─────────────────────────────────────────────────────

  describe('uploadMedia', () => {
    function makeFormData(
      name = 'test.jpg',
      type = 'image/jpeg',
      content = 'file-data'
    ) {
      const formData = new FormData()
      formData.append('file', new File([content], name, { type }))
      return formData
    }

    it('returns error when not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const result = await uploadMedia(
        makeFormData(),
        'observation',
        'parent-1'
      )

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when no file in FormData', async () => {
      setupUser()
      const emptyForm = new FormData()

      const result = await uploadMedia(emptyForm, 'observation', 'parent-1')

      expect(result).toEqual({ error: 'No file provided' })
    })

    it('returns error on storage upload failure', async () => {
      setupUser()
      mockStorage.upload.mockResolvedValueOnce({
        error: { message: 'Upload failed' },
      })

      const result = await uploadMedia(
        makeFormData(),
        'observation',
        'parent-1'
      )

      expect(result).toEqual({ error: 'Upload failed' })
    })

    it('returns error on DB insert failure', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed' },
      })

      const result = await uploadMedia(
        makeFormData(),
        'observation',
        'parent-1'
      )

      expect(result).toEqual({ error: 'Insert failed' })
    })

    it('succeeds with observation parentType', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: { id: 'media-1', file_path: 'path/to/file.jpg' },
        error: null,
      })

      const result = await uploadMedia(
        makeFormData(),
        'observation',
        'obs-1'
      )

      expect(result).toEqual({
        success: true,
        media: { id: 'media-1', file_path: 'path/to/file.jpg' },
      })
      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({ observation_id: 'obs-1' })
      )
    })

    it('succeeds with sighting parentType', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: { id: 'media-1' },
        error: null,
      })

      const result = await uploadMedia(
        makeFormData(),
        'sighting',
        'sight-1'
      )

      expect(result).toEqual(expect.objectContaining({ success: true }))
      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({ sighting_id: 'sight-1' })
      )
    })

    it('sets mediaType to VIDEO for video file', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: { id: 'media-1' },
        error: null,
      })

      await uploadMedia(
        makeFormData('clip.mp4', 'video/mp4'),
        'observation',
        'obs-1'
      )

      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({ media_type: 'VIDEO' })
      )
    })

    it('sets mediaType to PHOTO for image file', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: { id: 'media-1' },
        error: null,
      })

      await uploadMedia(
        makeFormData('photo.jpg', 'image/jpeg'),
        'observation',
        'obs-1'
      )

      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({ media_type: 'PHOTO' })
      )
    })

    it('includes exifData when provided', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: { id: 'media-1' },
        error: null,
      })

      await uploadMedia(makeFormData(), 'observation', 'obs-1', {
        lat: 1.35,
        lng: 103.82,
        datetime: '2026-04-15T08:00:00',
      })

      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          exif_lat: 1.35,
          exif_lng: 103.82,
          exif_datetime: '2026-04-15T08:00:00',
        })
      )
    })

    it('sets exif fields to null when no exifData', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: { id: 'media-1' },
        error: null,
      })

      await uploadMedia(makeFormData(), 'observation', 'obs-1')

      expect(methods.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          exif_lat: null,
          exif_lng: null,
          exif_datetime: null,
        })
      )
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

    it('deletes media from storage and database', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: { file_path: 'user-1/obs-1/file.jpg' },
        error: null,
      })

      const result = await deleteMedia('media-1')

      expect(result).toEqual({ success: true })
      expect(mockSupabase.storage.from).toHaveBeenCalledWith(
        'observation-media'
      )
      expect(mockStorage.remove).toHaveBeenCalledWith([
        'user-1/obs-1/file.jpg',
      ])
      expect(mockSupabase.from).toHaveBeenCalledWith('media')
      expect(methods.delete).toHaveBeenCalled()
    })

    it('returns error on DB delete failure', async () => {
      setupUser()
      methods.single.mockResolvedValueOnce({
        data: { file_path: 'user-1/obs-1/file.jpg' },
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
