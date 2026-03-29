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
})
