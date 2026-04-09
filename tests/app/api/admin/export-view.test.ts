import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'

const {
  mockGetUser,
  mockProfileSingle,
  mockFetchAllRows,
  mockBuildViewExportWorkbook,
  mockBuildViewExportData,
  mockDownloadMediaFile,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSingle: vi.fn(),
  mockFetchAllRows: vi.fn(),
  mockBuildViewExportWorkbook: vi.fn(),
  mockBuildViewExportData: vi.fn(),
  mockDownloadMediaFile: vi.fn(),
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
  createAdminClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/export-import/media-helpers', () => ({
  fetchAllRows: (...args: unknown[]) => mockFetchAllRows(...args),
  downloadMediaFile: (...args: unknown[]) => mockDownloadMediaFile(...args),
}))

vi.mock('@/lib/export-import/build-view-export-data', () => ({
  buildViewExportData: (...args: unknown[]) => mockBuildViewExportData(...args),
}))

vi.mock('@/lib/export-import/build-view-export-workbook', () => ({
  buildViewExportWorkbook: (...args: unknown[]) => mockBuildViewExportWorkbook(...args),
}))

import { GET } from '@/app/api/admin/export-view/route'

describe('GET /api/admin/export-view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchAllRows.mockResolvedValue([])
    mockBuildViewExportData.mockReturnValue({
      summaryRows: [],
      walkRows: [],
      observationRows: [],
      sightingRows: [],
      incidentRows: [],
      mediaRows: [],
      mediaManifest: [],
    })
    mockBuildViewExportWorkbook.mockResolvedValue(Buffer.from('fake-view-xlsx'))
    mockDownloadMediaFile.mockResolvedValue({ data: new TextEncoder().encode('media').buffer, error: null })
  })

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const response = await GET()
    expect(response.status).toBe(401)
    expect((await response.json()).error).toBe('Not authenticated')
  })

  it('returns 403 when user is not an admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'VOLUNTEER' } })

    const response = await GET()
    expect(response.status).toBe(403)
    expect((await response.json()).error).toBe('Forbidden')
  })

  it('returns a zip containing primap-view.xlsx', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Disposition')).toContain('primap-view-export-')

    const zip = await JSZip.loadAsync(await response.arrayBuffer())
    expect(zip.file('primap-view.xlsx')).not.toBeNull()
  })

  it('includes readable media paths in the zip', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockBuildViewExportData.mockReturnValue({
      summaryRows: [],
      walkRows: [],
      observationRows: [],
      sightingRows: [],
      incidentRows: [],
      mediaRows: [],
      mediaManifest: [
        {
          storagePath: 'u1/o1/photo.jpg',
          zipPath: 'media/Round 1/2026-03-14 - Pasir Ris Park/Tan Wei Ming/observation/photo.jpg',
        },
      ],
    })

    const response = await GET()
    const zip = await JSZip.loadAsync(await response.arrayBuffer())
    expect(zip.file('media/Round 1/2026-03-14 - Pasir Ris Park/Tan Wei Ming/observation/photo.jpg')).not.toBeNull()
  })

  it('adds export-warnings.txt when media download fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockBuildViewExportData.mockReturnValue({
      summaryRows: [],
      walkRows: [],
      observationRows: [],
      sightingRows: [],
      incidentRows: [],
      mediaRows: [],
      mediaManifest: [
        {
          storagePath: 'u1/o1/photo.jpg',
          zipPath: 'media/Round 1/2026-03-14 - Pasir Ris Park/Tan Wei Ming/observation/photo.jpg',
        },
      ],
    })
    mockDownloadMediaFile.mockResolvedValue({ data: null, error: 'Missing file' })

    const response = await GET()
    expect(response.headers.get('X-Export-Warning-Count')).toBe('1')

    const zip = await JSZip.loadAsync(await response.arrayBuffer())
    expect(zip.file('export-warnings.txt')).not.toBeNull()
  })
})
