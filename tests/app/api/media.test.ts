import { NextRequest } from 'next/server'

// ─── Mocks ─────────────────────────────────────────────────────────────────

const mockStorage = {
  upload: vi.fn().mockResolvedValue({ error: null }),
  remove: vi.fn().mockResolvedValue({ error: null }),
}

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
  },
  from: vi.fn(),
  storage: {
    from: vi.fn().mockReturnValue(mockStorage),
  },
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

import { POST } from '@/app/api/media/route'

// ─── Helpers ────────────────────────────────────────────────────────────────

function setupUser(userId = 'user-1') {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
  })
}

/**
 * Create a NextRequest with a FormData body that works in vitest/jsdom.
 * We override .formData() to avoid body-parsing issues.
 */
function makeRequest(formData: FormData): NextRequest {
  const req = new NextRequest('http://localhost:3000/api/media', {
    method: 'POST',
  })
  // Override formData() to return our test data directly
  vi.spyOn(req, 'formData').mockResolvedValue(formData)
  return req
}

function makeFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData()
  formData.append('file', new File(['file-data'], overrides.fileName ?? 'test.jpg', {
    type: overrides.fileType ?? 'image/jpeg',
  }))
  formData.append('parentType', overrides.parentType ?? 'observation')
  formData.append('parentId', overrides.parentId ?? 'parent-1')
  if (overrides.exifLat) formData.append('exifLat', overrides.exifLat)
  if (overrides.exifLng) formData.append('exifLng', overrides.exifLng)
  if (overrides.exifDatetime) formData.append('exifDatetime', overrides.exifDatetime)
  return formData
}

/**
 * Configure mock chain for the media upload flow.
 * The route handler calls from() three times:
 * 1. from('app_settings').select().limit().single() → settings
 * 2. from('media').select(*,{count,head}).eq(column, parentId) → {count, error}
 * 3. from('media').insert({...}).select().single() → {data, error}
 */
function setupMediaUploadMocks(opts: {
  settings?: { max_media_per_report: number } | null
  settingsError?: boolean
  count?: number | null
  countError?: { message: string } | null
  insertData?: Record<string, unknown> | null
  insertError?: { message: string } | null
  uploadError?: { message: string } | null
}) {
  const settingsChain = {
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: opts.settingsError ? null : (opts.settings ?? { max_media_per_report: 10 }),
      error: opts.settingsError ? { message: 'Settings error' } : null,
    }),
  }

  const countChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({
      count: opts.count ?? 0,
      error: opts.countError ?? null,
    }),
  }

  const insertChain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: opts.insertData ?? null,
      error: opts.insertError ?? null,
    }),
  }

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'app_settings') return settingsChain
    // Differentiate the two 'media' calls: count has .select().eq(), insert has .insert()
    // We return countChain first, then insertChain
    return countChain._used ? insertChain : (() => { countChain._used = true; return countChain })()
  })
  // Track if countChain has been used already
  ;(countChain as Record<string, unknown>)._used = false

  if (opts.uploadError) {
    mockStorage.upload.mockResolvedValue({ error: opts.uploadError })
  } else {
    mockStorage.upload.mockResolvedValue({ error: null })
  }

  return { settingsChain, countChain, insertChain }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/media', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    mockStorage.upload.mockResolvedValue({ error: null })
    mockStorage.remove.mockResolvedValue({ error: null })
  })

  // ─── Auth ──────────────────────────────────────────────────────────────

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body.error).toBe('Not authenticated')
    })
  })

  // ─── Input validation ─────────────────────────────────────────────────

  describe('input validation', () => {
    it('returns error when no file is provided', async () => {
      setupUser()
      const formData = new FormData()
      formData.append('parentType', 'observation')
      formData.append('parentId', 'parent-1')

      const response = await POST(makeRequest(formData))
      const body = await response.json()

      expect(body.error).toBe('No file provided')
    })

    it('returns error when no parentId is provided', async () => {
      setupUser()
      const formData = new FormData()
      formData.append('file', new File(['data'], 'test.jpg', { type: 'image/jpeg' }))
      formData.append('parentType', 'observation')

      const response = await POST(makeRequest(formData))
      const body = await response.json()

      expect(body.error).toBe('No parentId provided')
    })
  })

  // ─── Media limit enforcement ──────────────────────────────────────────

  describe('media limit enforcement', () => {
    it('returns 422 when observation already has max media files', async () => {
      setupUser()
      setupMediaUploadMocks({
        settings: { max_media_per_report: 10 },
        count: 10,
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(422)
      expect(body.error).toBe('Maximum of 10 media files allowed per report')
    })

    it('returns 422 when sighting already has max media files', async () => {
      setupUser()
      setupMediaUploadMocks({
        settings: { max_media_per_report: 10 },
        count: 10,
      })

      const response = await POST(makeRequest(makeFormData({ parentType: 'sighting' })))
      const body = await response.json()

      expect(response.status).toBe(422)
      expect(body.error).toBe('Maximum of 10 media files allowed per report')
    })

    it('allows upload when count is below the limit', async () => {
      setupUser()
      const { insertChain } = setupMediaUploadMocks({
        settings: { max_media_per_report: 10 },
        count: 9,
        insertData: { id: 'media-1', file_path: 'path/to/file.jpg' },
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(insertChain.insert).toHaveBeenCalled()
    })

    it('allows upload when count is 0 (first upload)', async () => {
      setupUser()
      setupMediaUploadMocks({
        settings: { max_media_per_report: 10 },
        count: 0,
        insertData: { id: 'media-1', file_path: 'path/to/file.jpg' },
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })

    it('returns 500 when count query fails', async () => {
      setupUser()
      setupMediaUploadMocks({
        countError: { message: 'DB error' },
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error).toBe('Failed to check media count')
    })

    it('queries observation_id column for observation parentType', async () => {
      setupUser()
      const { countChain } = setupMediaUploadMocks({
        count: 10,
      })

      await POST(makeRequest(makeFormData({ parentType: 'observation', parentId: 'obs-1' })))

      expect(countChain.eq).toHaveBeenCalledWith('observation_id', 'obs-1')
    })

    it('queries sighting_id column for sighting parentType', async () => {
      setupUser()
      const { countChain } = setupMediaUploadMocks({
        count: 10,
      })

      await POST(makeRequest(makeFormData({ parentType: 'sighting', parentId: 'sight-1' })))

      expect(countChain.eq).toHaveBeenCalledWith('sighting_id', 'sight-1')
    })

    it('rejects when count equals limit exactly (boundary)', async () => {
      setupUser()
      setupMediaUploadMocks({
        settings: { max_media_per_report: 5 },
        count: 5,
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(422)
      expect(body.error).toBe('Maximum of 5 media files allowed per report')
    })

    it('allows upload when count is one below limit (boundary)', async () => {
      setupUser()
      setupMediaUploadMocks({
        settings: { max_media_per_report: 5 },
        count: 4,
        insertData: { id: 'media-1' },
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  // ─── Configurable limit ───────────────────────────────────────────────

  describe('configurable limit', () => {
    it('respects custom limit from app_settings (limit=5, count=5 → 422)', async () => {
      setupUser()
      setupMediaUploadMocks({
        settings: { max_media_per_report: 5 },
        count: 5,
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(422)
      expect(body.error).toBe('Maximum of 5 media files allowed per report')
    })

    it('respects custom limit from app_settings (limit=5, count=4 → success)', async () => {
      setupUser()
      setupMediaUploadMocks({
        settings: { max_media_per_report: 5 },
        count: 4,
        insertData: { id: 'media-1' },
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })

    it('falls back to default 10 when app_settings returns null', async () => {
      setupUser()
      setupMediaUploadMocks({
        settings: null,
        count: 10,
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(422)
      expect(body.error).toBe('Maximum of 10 media files allowed per report')
    })

    it('falls back to default 10 when app_settings query errors', async () => {
      setupUser()
      setupMediaUploadMocks({
        settingsError: true,
        count: 10,
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(422)
      expect(body.error).toBe('Maximum of 10 media files allowed per report')
    })

    it('allows upload at count=9 with default limit 10 when settings missing', async () => {
      setupUser()
      setupMediaUploadMocks({
        settings: null,
        count: 9,
        insertData: { id: 'media-1' },
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  // ─── Storage & DB ─────────────────────────────────────────────────────

  describe('storage and database', () => {
    it('returns error on storage upload failure', async () => {
      setupUser()
      setupMediaUploadMocks({
        count: 0,
        uploadError: { message: 'Storage full' },
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(body.error).toBe('Storage full')
    })

    it('returns error on DB insert failure', async () => {
      setupUser()
      setupMediaUploadMocks({
        count: 0,
        insertError: { message: 'Insert failed' },
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(body.error).toBe('Insert failed')
    })

    it('returns success with correct media data on successful upload', async () => {
      setupUser()
      const mediaData = { id: 'media-1', file_path: 'user-1/parent-1/abc.jpg', file_name: 'test.jpg' }
      setupMediaUploadMocks({
        count: 0,
        insertData: mediaData,
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.media).toEqual(mediaData)
    })

    it('maps observation parentType to observation_id field in insert', async () => {
      setupUser()
      const { insertChain } = setupMediaUploadMocks({
        count: 0,
        insertData: { id: 'media-1' },
      })

      await POST(makeRequest(makeFormData({ parentType: 'observation', parentId: 'obs-1' })))

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ observation_id: 'obs-1' })
      )
    })

    it('maps sighting parentType to sighting_id field in insert', async () => {
      setupUser()
      const { insertChain } = setupMediaUploadMocks({
        count: 0,
        insertData: { id: 'media-1' },
      })

      await POST(makeRequest(makeFormData({ parentType: 'sighting', parentId: 'sight-1' })))

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ sighting_id: 'sight-1' })
      )
    })

    it('detects VIDEO media type for video/* MIME types', async () => {
      setupUser()
      const { insertChain } = setupMediaUploadMocks({
        count: 0,
        insertData: { id: 'media-1' },
      })

      await POST(makeRequest(makeFormData({ fileName: 'clip.mp4', fileType: 'video/mp4' })))

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ media_type: 'VIDEO' })
      )
    })

    it('detects PHOTO media type for image/* MIME types', async () => {
      setupUser()
      const { insertChain } = setupMediaUploadMocks({
        count: 0,
        insertData: { id: 'media-1' },
      })

      await POST(makeRequest(makeFormData({ fileName: 'photo.jpg', fileType: 'image/jpeg' })))

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ media_type: 'PHOTO' })
      )
    })

    it('includes EXIF data when provided in FormData', async () => {
      setupUser()
      const { insertChain } = setupMediaUploadMocks({
        count: 0,
        insertData: { id: 'media-1' },
      })

      await POST(makeRequest(makeFormData({
        exifLat: '1.35',
        exifLng: '103.82',
        exifDatetime: '2026-04-15T08:00:00',
      })))

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          exif_lat: 1.35,
          exif_lng: 103.82,
          exif_datetime: '2026-04-15T08:00:00',
        })
      )
    })

    it('sets EXIF fields to null when not provided', async () => {
      setupUser()
      const { insertChain } = setupMediaUploadMocks({
        count: 0,
        insertData: { id: 'media-1' },
      })

      await POST(makeRequest(makeFormData()))

      expect(insertChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          exif_lat: null,
          exif_lng: null,
          exif_datetime: null,
        })
      )
    })

    it('uploads file to observation-media storage bucket', async () => {
      setupUser()
      setupMediaUploadMocks({
        count: 0,
        insertData: { id: 'media-1' },
      })

      await POST(makeRequest(makeFormData()))

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('observation-media')
      expect(mockStorage.upload).toHaveBeenCalled()
    })
  })

  // ─── Trigger-enforced limit (race-safe path) ──────────────────────────
  // The DB trigger `enforce_max_media_per_report_trigger` is the source of
  // truth and serializes concurrent inserts per parent. The route handler
  // pre-check is only an optimization; if two requests race past it, one
  // lands in the insert error branch with the trigger's RAISE EXCEPTION
  // message and must (a) clean up the just-uploaded storage object and
  // (b) translate the error into HTTP 422 instead of a generic 500.

  describe('trigger-enforced limit', () => {
    it('returns 422 when insert fails with the trigger error message', async () => {
      setupUser()
      setupMediaUploadMocks({
        // Pre-check passes (count below limit) so the request reaches the insert
        count: 0,
        // …but the trigger fires because some other concurrent request inserted first
        insertError: { message: 'Maximum of 10 media files allowed per report' },
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(422)
      expect(body.error).toBe('Maximum of 10 media files allowed per report')
    })

    it('cleans up the storage object when the insert fails with the trigger error', async () => {
      setupUser()
      setupMediaUploadMocks({
        count: 0,
        insertError: { message: 'Maximum of 10 media files allowed per report' },
      })

      await POST(makeRequest(makeFormData()))

      expect(mockStorage.remove).toHaveBeenCalledTimes(1)
      // The path is `${user.id}/${parentId}/${uuid}.${ext}` — assert prefix only
      const removeArg = mockStorage.remove.mock.calls[0]?.[0] as string[]
      expect(removeArg).toHaveLength(1)
      expect(removeArg[0]).toMatch(/^user-1\/parent-1\/.+\.jpg$/)
    })

    it('cleans up the storage object on a generic insert failure too', async () => {
      setupUser()
      setupMediaUploadMocks({
        count: 0,
        insertError: { message: 'Insert failed' },
      })

      await POST(makeRequest(makeFormData()))

      expect(mockStorage.remove).toHaveBeenCalledTimes(1)
    })

    it('does not return 422 for generic insert failures (only trigger limit errors map to 422)', async () => {
      setupUser()
      setupMediaUploadMocks({
        count: 0,
        insertError: { message: 'Insert failed' },
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).not.toBe(422)
      expect(body.error).toBe('Insert failed')
    })

    it('does not call storage.remove on a successful insert', async () => {
      setupUser()
      setupMediaUploadMocks({
        count: 0,
        insertData: { id: 'media-1' },
      })

      await POST(makeRequest(makeFormData()))

      expect(mockStorage.remove).not.toHaveBeenCalled()
    })

    it('swallows storage.remove failures so the original error is still returned', async () => {
      setupUser()
      setupMediaUploadMocks({
        count: 0,
        insertError: { message: 'Maximum of 10 media files allowed per report' },
      })
      mockStorage.remove.mockRejectedValueOnce(new Error('Storage cleanup blew up'))

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(422)
      expect(body.error).toBe('Maximum of 10 media files allowed per report')
    })

    it('matches the trigger error message regardless of the configured limit value', async () => {
      setupUser()
      setupMediaUploadMocks({
        settings: { max_media_per_report: 25 },
        count: 0,
        insertError: { message: 'Maximum of 25 media files allowed per report' },
      })

      const response = await POST(makeRequest(makeFormData()))
      const body = await response.json()

      expect(response.status).toBe(422)
      expect(body.error).toBe('Maximum of 25 media files allowed per report')
    })
  })
})
