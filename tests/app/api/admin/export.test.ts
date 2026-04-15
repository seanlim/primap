import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import JSZip from 'jszip'

// --- Hoisted mocks ---

const {
  mockGetUser,
  mockProfileSingle,
  mockFetchAllRows,
  mockBuildExportWorkbook,
  mockDownloadMediaFile,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileSingle: vi.fn(),
  mockFetchAllRows: vi.fn(),
  mockBuildExportWorkbook: vi.fn(),
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

vi.mock('@/lib/export-import/media-helpers', () => ({
  fetchAllRows: (...args: unknown[]) => mockFetchAllRows(...args),
  downloadMediaFile: (...args: unknown[]) => mockDownloadMediaFile(...args),
}))

vi.mock('@/lib/export-import/export-workbook', () => ({
  buildExportWorkbook: (...args: unknown[]) => mockBuildExportWorkbook(...args),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}))

import { GET } from '@/app/api/admin/export/route'

describe('GET /api/admin/export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchAllRows.mockResolvedValue([])
    mockBuildExportWorkbook.mockResolvedValue(Buffer.from('fake-xlsx'))
    mockDownloadMediaFile.mockResolvedValue({ data: null, error: 'No file' })
  })

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const response = await GET()
    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.error).toBe('Not authenticated')
  })

  it('returns 403 when user is not an admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'VOLUNTEER' } })

    const response = await GET()
    expect(response.status).toBe(403)

    const body = await response.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns a zip file for authenticated admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/zip')
    expect(response.headers.get('Content-Disposition')).toContain('primap-export-')
    expect(response.headers.get('Content-Disposition')).toContain('.zip')
  })

  it('zip contains primap-data.xlsx', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    const response = await GET()
    const arrayBuffer = await response.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    expect(zip.file('primap-data.xlsx')).not.toBeNull()
  })

  it('calls fetchAllRows for all 9 tables', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    await GET()

    expect(mockFetchAllRows).toHaveBeenCalledTimes(9)
  })

  it('calls buildExportWorkbook with table data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    await GET()

    expect(mockBuildExportWorkbook).toHaveBeenCalledTimes(1)
    expect(mockBuildExportWorkbook).toHaveBeenCalledWith(
      expect.objectContaining({
        profiles: expect.any(Array),
        observations: expect.any(Array),
      })
    )
  })

  it('returns 500 when fetchAllRows throws', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockFetchAllRows.mockRejectedValueOnce(new Error('DB connection lost'))

    const response = await GET()
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.error).toBe('DB connection lost')
  })

  it('returns 500 when buildExportWorkbook throws', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockBuildExportWorkbook.mockRejectedValueOnce(new Error('XLSX generation failed'))

    const response = await GET()
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.error).toBe('XLSX generation failed')
  })

  it('includes date in filename', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    const response = await GET()
    const disposition = response.headers.get('Content-Disposition')!
    // Should match pattern primap-export-YYYY-MM-DD.zip
    expect(disposition).toMatch(/primap-export-\d{4}-\d{2}-\d{2}\.zip/)
  })

  it('downloads incident-linked media from the incident-media bucket', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockFetchAllRows.mockImplementation(async (_client: unknown, table: string) => {
      if (table === 'media') {
        return [{ id: 'm1', file_path: 'u1/incidents/i1/photo.jpg', incident_id: 'i1' }]
      }
      return []
    })

    await GET()

    expect(mockDownloadMediaFile).toHaveBeenCalledWith(
      expect.anything(),
      'u1/incidents/i1/photo.jpg',
      { bucket: 'incident-media' }
    )
  })
})
