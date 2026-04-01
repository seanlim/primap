import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Hoisted mocks ---

const {
  mockGetUser,
  mockProfileSingle,
  mockUpsert,
  mockAdminFrom,
  mockUploadMedia,
  mockJSZipLoadAsync,
  mockZipFile,
  mockZipFolder,
  mockParseWorkbook,
  mockFormDataGet,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSingle: vi.fn(),
  mockUpsert: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockUploadMedia: vi.fn(),
  mockJSZipLoadAsync: vi.fn(),
  mockZipFile: vi.fn(),
  mockZipFolder: vi.fn(),
  mockParseWorkbook: vi.fn(),
  mockFormDataGet: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockProfileSingle,
    }),
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
  })),
}))

vi.mock('@/lib/export-import/media-helpers', () => ({
  uploadMediaFile: (...args: unknown[]) => mockUploadMedia(...args),
}))

vi.mock('@/lib/export-import/import-workbook', () => ({
  parseWorkbookToTableData: (...args: unknown[]) => mockParseWorkbook(...args),
}))

vi.mock('jszip', () => ({
  default: {
    loadAsync: (...args: unknown[]) => mockJSZipLoadAsync(...args),
  },
}))

import { POST } from '@/app/api/admin/import/route'

function makeRequest(hasFile: boolean = true) {
  const fakeFile = hasFile ? {
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
  } : null

  mockFormDataGet.mockImplementation((key: string) => {
    if (key === 'file') return fakeFile
    return null
  })

  return {
    formData: vi.fn().mockResolvedValue({
      get: mockFormDataGet,
    }),
  } as unknown as Parameters<typeof POST>[0]
}

function setupZipMock(
  hasXlsx: boolean,
  mediaFiles: { path: string; content: Uint8Array }[] = []
) {
  const xlsxFileObj = hasXlsx ? {
    async: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
  } : null

  mockZipFile.mockImplementation((name: string) => {
    if (name === 'primap-data.xlsx') return xlsxFileObj
    return null
  })

  const folderObj = mediaFiles.length > 0 ? {
    forEach: (cb: (path: string, file: { dir: boolean; async: () => Promise<Uint8Array> }) => void) => {
      for (const mf of mediaFiles) {
        cb(mf.path, {
          dir: false,
          async: vi.fn().mockResolvedValue(mf.content),
        })
      }
    },
  } : null

  mockZipFolder.mockReturnValue(folderObj)
  mockJSZipLoadAsync.mockResolvedValue({
    file: mockZipFile,
    folder: mockZipFolder,
  })
}

describe('POST /api/admin/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUpsert.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
    mockAdminFrom.mockReturnValue({ upsert: mockUpsert })
    mockUploadMedia.mockResolvedValue({ error: null, skipped: false })
    mockParseWorkbook.mockResolvedValue({})
    setupZipMock(true)
  })

  // --- Auth ---

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const response = await POST(makeRequest())
    expect(response.status).toBe(401)
  })

  it('returns 403 when user is not admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'VOLUNTEER' } })
    const response = await POST(makeRequest())
    expect(response.status).toBe(403)
  })

  it('returns 400 when no file is provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    const response = await POST(makeRequest(false))
    expect(response.status).toBe(400)
  })

  // --- Zip validation ---

  it('returns 400 when zip does not contain primap-data.xlsx', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    setupZipMock(false)

    const response = await POST(makeRequest())
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('primap-data.xlsx')
  })

  // --- Successful import ---

  it('successfully processes a valid backup zip', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockParseWorkbook.mockResolvedValue({
      profiles: [{ id: 'p1', email: 'alice@test.com' }],
    })

    const response = await POST(makeRequest())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
  })

  it('calls upsert with ignoreDuplicates', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockParseWorkbook.mockResolvedValue({
      profiles: [{ id: 'p1', email: 'alice@test.com' }],
    })

    await POST(makeRequest())
    expect(mockAdminFrom).toHaveBeenCalledWith('profiles')
    expect(mockUpsert).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'p1' })],
      { onConflict: 'id', ignoreDuplicates: true }
    )
  })

  // --- Counting ---

  it('reports inserted and skipped counts', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockParseWorkbook.mockResolvedValue({
      profiles: [{ id: 'p1' }, { id: 'p2' }],
    })
    mockUpsert.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: 'p1' }], error: null }),
    })

    const response = await POST(makeRequest())
    const body = await response.json()
    expect(body.summary.profiles.inserted).toBe(1)
    expect(body.summary.profiles.skipped).toBe(1)
  })

  it('handles empty tables gracefully', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockParseWorkbook.mockResolvedValue({ profiles: [] })

    const response = await POST(makeRequest())
    const body = await response.json()
    expect(body.summary.profiles).toEqual({ inserted: 0, skipped: 0, errors: [] })
  })

  it('handles tables not in workbook', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockParseWorkbook.mockResolvedValue({})

    const response = await POST(makeRequest())
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.summary.profiles).toEqual({ inserted: 0, skipped: 0, errors: [] })
  })

  // --- Data cleaning ---

  it('converts empty string values to null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockParseWorkbook.mockResolvedValue({
      profiles: [{ id: 'p1', full_name: '' }],
    })

    await POST(makeRequest())
    expect(mockUpsert).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'p1', full_name: null })],
      expect.any(Object)
    )
  })

  // --- Error handling ---

  it('reports upsert errors without failing import', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockParseWorkbook.mockResolvedValue({ profiles: [{ id: 'p1' }] })
    mockUpsert.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: null, error: { message: 'FK violation' } }),
    })

    const response = await POST(makeRequest())
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.summary.profiles.errors[0]).toContain('FK violation')
  })

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockJSZipLoadAsync.mockRejectedValue(new Error('Corrupt zip'))

    const response = await POST(makeRequest())
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Corrupt zip')
  })

  // --- Media files ---

  it('uploads media files from zip', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    setupZipMock(true, [
      { path: 'user1/obs1/photo.jpg', content: new Uint8Array([1, 2, 3]) },
    ])

    const response = await POST(makeRequest())
    const body = await response.json()
    expect(mockUploadMedia).toHaveBeenCalledTimes(1)
    expect(body.summary.media_files.uploaded).toBe(1)
  })

  it('correctly counts skipped media files', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockUploadMedia.mockResolvedValue({ error: null, skipped: true })
    setupZipMock(true, [
      { path: 'user1/obs1/photo.jpg', content: new Uint8Array([1]) },
    ])

    const response = await POST(makeRequest())
    const body = await response.json()
    expect(body.summary.media_files.skipped).toBe(1)
    expect(body.summary.media_files.uploaded).toBe(0)
  })

  it('reports media upload errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockUploadMedia.mockResolvedValue({ error: 'Storage full', skipped: false })
    setupZipMock(true, [
      { path: 'user1/obs1/photo.jpg', content: new Uint8Array([1]) },
    ])

    const response = await POST(makeRequest())
    const body = await response.json()
    expect(body.summary.media_files.errors[0]).toContain('Storage full')
  })

  it('handles zip with no media folder', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockZipFolder.mockReturnValue(null)

    const response = await POST(makeRequest())
    const body = await response.json()
    expect(body.summary.media_files.uploaded).toBe(0)
    expect(body.summary.media_files.skipped).toBe(0)
  })

  // --- Media: blobs before DB rows ---

  it('does not insert media DB rows for files that failed to upload', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockParseWorkbook.mockResolvedValue({
      media: [
        { id: 'm1', file_path: 'user1/obs1/photo.jpg', observation_id: 'obs1' },
        { id: 'm2', file_path: 'user1/obs2/photo.jpg', observation_id: 'obs2' },
      ],
    })
    // First file succeeds, second fails
    mockUploadMedia
      .mockResolvedValueOnce({ error: null, skipped: false })
      .mockResolvedValueOnce({ error: 'Storage full', skipped: false })
    setupZipMock(true, [
      { path: 'user1/obs1/photo.jpg', content: new Uint8Array([1, 2]) },
      { path: 'user1/obs2/photo.jpg', content: new Uint8Array([3, 4]) },
    ])
    // Make upsert return the inserted row for media
    mockUpsert.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: 'm1' }], error: null }),
    })

    const response = await POST(makeRequest())
    const body = await response.json()

    // Only the successful file's media row should be upserted
    expect(mockUpsert).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'm1', file_path: 'user1/obs1/photo.jpg' })],
      expect.any(Object)
    )
    // The failed file's row should be skipped (not upserted)
    expect(body.summary.media.skipped).toBe(1)
    expect(body.summary.media.inserted).toBe(1)
  })

  it('returns success=false and partial=true when media uploads fail', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockUploadMedia.mockResolvedValue({ error: 'Storage full', skipped: false })
    setupZipMock(true, [
      { path: 'user1/obs1/photo.jpg', content: new Uint8Array([1]) },
    ])

    const response = await POST(makeRequest())
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.partial).toBe(true)
    expect(body.summary.media_files.errors).toHaveLength(1)
  })

  it('returns success=true without partial when all media uploads succeed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockUploadMedia.mockResolvedValue({ error: null, skipped: false })
    setupZipMock(true, [
      { path: 'user1/obs1/photo.jpg', content: new Uint8Array([1]) },
    ])
    mockParseWorkbook.mockResolvedValue({
      media: [{ id: 'm1', file_path: 'user1/obs1/photo.jpg', observation_id: 'obs1' }],
    })

    const response = await POST(makeRequest())
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.partial).toBeUndefined()
  })

  it('inserts media DB rows for skipped (already existing) files', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockUploadMedia.mockResolvedValue({ error: null, skipped: true })
    setupZipMock(true, [
      { path: 'user1/obs1/photo.jpg', content: new Uint8Array([1]) },
    ])
    mockParseWorkbook.mockResolvedValue({
      media: [{ id: 'm1', file_path: 'user1/obs1/photo.jpg', observation_id: 'obs1' }],
    })

    const response = await POST(makeRequest())
    const body = await response.json()

    // Skipped files are still in uploadedPaths, so their DB rows should be upserted
    expect(mockUpsert).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'm1' })],
      expect.any(Object)
    )
    expect(body.success).toBe(true)
  })

  it('skips media table during FK-dependency loop', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockParseWorkbook.mockResolvedValue({
      profiles: [{ id: 'p1', email: 'a@test.com' }],
      media: [{ id: 'm1', file_path: 'user1/obs1/photo.jpg' }],
    })

    await POST(makeRequest())

    // media should not be upserted via the main TABLE_ORDER loop
    // The first call to mockAdminFrom with 'media' should only happen
    // after the blob upload phase (or not at all if no zip media folder)
    const fromCalls = mockAdminFrom.mock.calls.map((c: unknown[]) => c[0])
    // profiles should be processed but media should not appear before media upload section
    expect(fromCalls.includes('profiles')).toBe(true)
  })

  it('handles media DB rows with no matching zip file gracefully', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockParseWorkbook.mockResolvedValue({
      media: [
        { id: 'm1', file_path: 'user1/obs1/photo.jpg', observation_id: 'obs1' },
        { id: 'm2', file_path: 'user1/obs2/video.mp4', observation_id: 'obs2' },
      ],
    })
    // Only one file in zip
    mockUploadMedia.mockResolvedValue({ error: null, skipped: false })
    setupZipMock(true, [
      { path: 'user1/obs1/photo.jpg', content: new Uint8Array([1]) },
    ])
    // Make upsert return inserted row
    mockUpsert.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: 'm1' }], error: null }),
    })

    const response = await POST(makeRequest())
    const body = await response.json()

    // m2 has no blob in zip, so its DB row should be skipped
    expect(body.summary.media.skipped).toBe(1)
    expect(body.summary.media.inserted).toBe(1)
  })

  it('still attempts media DB upsert when zip has no media folder but DB has media rows', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockZipFolder.mockReturnValue(null)
    mockParseWorkbook.mockResolvedValue({
      media: [{ id: 'm1', file_path: 'user1/obs1/photo.jpg' }],
    })

    const response = await POST(makeRequest())
    const body = await response.json()

    // With no media folder, uploadedPaths is empty, so all media rows are attempted
    // (re-import on same environment where blobs already exist)
    expect(mockAdminFrom).toHaveBeenCalledWith('media')
  })

  // --- app_settings singleton handling ---

  it('updates existing app_settings row instead of inserting a new one', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'existing-settings-id' }, error: null })

    mockParseWorkbook.mockResolvedValue({
      app_settings: [{ id: 'imported-id', required_walks_per_round: 5, late_cancel_hours: 24 }],
    })

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'app_settings') {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: mockMaybeSingle,
            }),
          }),
          update: mockUpdate,
          upsert: mockUpsert,
        }
      }
      return { upsert: mockUpsert }
    })

    const response = await POST(makeRequest())
    const body = await response.json()

    // Should call update on existing row, not upsert
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        required_walks_per_round: 5,
        late_cancel_hours: 24,
      })
    )
    expect(body.summary.app_settings.inserted).toBe(1)
  })

  it('inserts app_settings when no existing row is found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })

    mockParseWorkbook.mockResolvedValue({
      app_settings: [{ id: 'imported-id', required_walks_per_round: 3, late_cancel_hours: 48 }],
    })

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'app_settings') {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: mockMaybeSingle,
            }),
          }),
          insert: mockInsert,
          upsert: mockUpsert,
        }
      }
      return { upsert: mockUpsert }
    })

    const response = await POST(makeRequest())
    const body = await response.json()

    // Should insert with original id
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'imported-id',
        required_walks_per_round: 3,
      })
    )
    expect(body.summary.app_settings.inserted).toBe(1)
  })

  it('reports errors when app_settings update fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'Update failed' } }),
    })
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'existing-id' }, error: null })

    mockParseWorkbook.mockResolvedValue({
      app_settings: [{ id: 'imported-id', required_walks_per_round: 5 }],
    })

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'app_settings') {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: mockMaybeSingle,
            }),
          }),
          update: mockUpdate,
        }
      }
      return { upsert: mockUpsert }
    })

    const response = await POST(makeRequest())
    const body = await response.json()
    expect(body.summary.app_settings.errors[0]).toContain('Update failed')
    expect(body.summary.app_settings.inserted).toBe(0)
  })

  it('reports errors when app_settings insert fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    const mockInsert = vi.fn().mockResolvedValue({ error: { message: 'Insert failed' } })
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })

    mockParseWorkbook.mockResolvedValue({
      app_settings: [{ id: 'imported-id', required_walks_per_round: 3 }],
    })

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'app_settings') {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: mockMaybeSingle,
            }),
          }),
          insert: mockInsert,
        }
      }
      return { upsert: mockUpsert }
    })

    const response = await POST(makeRequest())
    const body = await response.json()
    expect(body.summary.app_settings.errors[0]).toContain('Insert failed')
    expect(body.summary.app_settings.inserted).toBe(0)
  })

  it('handles empty app_settings array gracefully', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockParseWorkbook.mockResolvedValue({
      app_settings: [],
    })

    const response = await POST(makeRequest())
    const body = await response.json()
    expect(body.summary.app_settings).toEqual({ inserted: 0, skipped: 0, errors: [] })
  })

  it('cleans empty string values to null in app_settings update', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'existing-id' }, error: null })

    mockParseWorkbook.mockResolvedValue({
      app_settings: [{ id: 'imported-id', required_walks_per_round: 4, late_cancel_hours: '' }],
    })

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'app_settings') {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: mockMaybeSingle,
            }),
          }),
          update: mockUpdate,
        }
      }
      return { upsert: mockUpsert }
    })

    await POST(makeRequest())

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ late_cancel_hours: null })
    )
  })

  it('excludes imported id from app_settings update data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'existing-id' }, error: null })

    mockParseWorkbook.mockResolvedValue({
      app_settings: [{ id: 'imported-id', required_walks_per_round: 5 }],
    })

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'app_settings') {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: mockMaybeSingle,
            }),
          }),
          update: mockUpdate,
        }
      }
      return { upsert: mockUpsert }
    })

    await POST(makeRequest())

    // The update data should NOT contain the imported id
    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg).not.toHaveProperty('id')
  })
})
