import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { buildExportWorkbook } from '@/lib/export-import/export-workbook'
import { TABLE_ORDER, TABLE_COLUMNS, type TableName } from '@/lib/export-import/constants'

function makeTableData(overrides: Partial<Record<TableName, Record<string, unknown>[]>> = {}) {
  const data = {} as Record<TableName, Record<string, unknown>[]>
  for (const table of TABLE_ORDER) {
    data[table] = overrides[table] ?? []
  }
  return data
}

async function parseWorkbook(buffer: ExcelJS.Buffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as ArrayBuffer)
  return workbook
}

describe('buildExportWorkbook', () => {
  it('creates a workbook with one sheet per table', async () => {
    const buffer = await buildExportWorkbook(makeTableData())
    const workbook = await parseWorkbook(buffer)

    expect(workbook.worksheets).toHaveLength(TABLE_ORDER.length)
    for (const table of TABLE_ORDER) {
      expect(workbook.getWorksheet(table)).toBeDefined()
    }
  })

  it('sheets are in TABLE_ORDER sequence', async () => {
    const buffer = await buildExportWorkbook(makeTableData())
    const workbook = await parseWorkbook(buffer)

    const sheetNames = workbook.worksheets.map(ws => ws.name)
    expect(sheetNames).toEqual([...TABLE_ORDER])
  })

  it('each sheet has correct header row matching TABLE_COLUMNS', async () => {
    const buffer = await buildExportWorkbook(makeTableData())
    const workbook = await parseWorkbook(buffer)

    for (const table of TABLE_ORDER) {
      const ws = workbook.getWorksheet(table)!
      const headerRow = ws.getRow(1)
      const headers: string[] = []
      headerRow.eachCell((cell, colNum) => {
        headers[colNum - 1] = String(cell.value)
      })
      expect(headers).toEqual(TABLE_COLUMNS[table])
    }
  })

  it('header row is bold', async () => {
    const buffer = await buildExportWorkbook(makeTableData())
    const workbook = await parseWorkbook(buffer)

    const ws = workbook.getWorksheet('profiles')!
    const headerRow = ws.getRow(1)
    headerRow.eachCell(cell => {
      expect(cell.font?.bold).toBe(true)
    })
  })

  it('writes data rows correctly', async () => {
    const data = makeTableData({
      profiles: [
        { id: 'p1', email: 'alice@test.com', full_name: 'Alice', avatar_url: null, role: 'ADMIN', status: 'ACTIVE', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
        { id: 'p2', email: 'bob@test.com', full_name: 'Bob', avatar_url: 'http://example.com/bob.jpg', role: 'VOLUNTEER', status: 'PENDING', created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' },
      ],
    })

    const buffer = await buildExportWorkbook(data)
    const workbook = await parseWorkbook(buffer)
    const ws = workbook.getWorksheet('profiles')!

    // Row 1 = header, Row 2 = first data row
    expect(ws.rowCount).toBe(3)
    expect(ws.getRow(2).getCell(1).value).toBe('p1')
    expect(ws.getRow(2).getCell(2).value).toBe('alice@test.com')
    expect(ws.getRow(3).getCell(1).value).toBe('p2')
    expect(ws.getRow(3).getCell(3).value).toBe('Bob')
  })

  it('handles null values as empty strings', async () => {
    const data = makeTableData({
      profiles: [
        { id: 'p1', email: 'a@b.com', full_name: null, avatar_url: null, role: 'VOLUNTEER', status: 'ACTIVE', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      ],
    })

    const buffer = await buildExportWorkbook(data)
    const workbook = await parseWorkbook(buffer)
    const ws = workbook.getWorksheet('profiles')!

    // full_name (col 3) and avatar_url (col 4) should be empty
    expect(ws.getRow(2).getCell(3).value).toBe('')
    expect(ws.getRow(2).getCell(4).value).toBe('')
  })

  it('preserves numeric values as numbers', async () => {
    const data = makeTableData({
      app_settings: [
        {
          id: 's1',
          required_walks_per_round: 4,
          reminder_send_weekday: 3,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    })

    const buffer = await buildExportWorkbook(data)
    const workbook = await parseWorkbook(buffer)
    const ws = workbook.getWorksheet('app_settings')!

    expect(ws.getRow(2).getCell(2).value).toBe(4)
    expect(ws.getRow(2).getCell(5).value).toBe(3)
  })

  it('preserves boolean values', async () => {
    const data = makeTableData({
      incidents: [
        { id: 'i1', slot_id: 's1', reported_by: 'p1', incident_type: 'OTHER', description: 'test', lat: null, lng: null, resolved: true, resolved_notes: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
        { id: 'i2', slot_id: 's1', reported_by: 'p1', incident_type: 'OTHER', description: 'test2', lat: null, lng: null, resolved: false, resolved_notes: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      ],
    })

    const buffer = await buildExportWorkbook(data)
    const workbook = await parseWorkbook(buffer)
    const ws = workbook.getWorksheet('incidents')!

    // resolved is column 8
    expect(ws.getRow(2).getCell(8).value).toBe(true)
    expect(ws.getRow(3).getCell(8).value).toBe(false)
  })

  it('includes incident_id in the media worksheet for backup round-tripping', async () => {
    const data = makeTableData({
      media: [
        {
          id: 'm1',
          observation_id: null,
          sighting_id: null,
          incident_id: 'inc-1',
          file_path: 'user1/incidents/inc-1/photo.jpg',
          file_name: 'photo.jpg',
          file_size: 1234,
          media_type: 'PHOTO',
          exif_lat: null,
          exif_lng: null,
          exif_datetime: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    })

    const buffer = await buildExportWorkbook(data)
    const workbook = await parseWorkbook(buffer)
    const ws = workbook.getWorksheet('media')!

    expect(ws.getRow(1).getCell(4).value).toBe('incident_id')
    expect(ws.getRow(2).getCell(4).value).toBe('inc-1')
  })

  it('handles empty tables (only header row)', async () => {
    const buffer = await buildExportWorkbook(makeTableData())
    const workbook = await parseWorkbook(buffer)

    for (const table of TABLE_ORDER) {
      const ws = workbook.getWorksheet(table)!
      expect(ws.rowCount).toBe(1) // header only
    }
  })

  it('handles large number of rows', async () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({
      id: `p${i}`,
      email: `user${i}@test.com`,
      full_name: `User ${i}`,
      avatar_url: null,
      role: 'VOLUNTEER',
      status: 'ACTIVE',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }))

    const data = makeTableData({ profiles: rows })
    const buffer = await buildExportWorkbook(data)
    const workbook = await parseWorkbook(buffer)
    const ws = workbook.getWorksheet('profiles')!

    expect(ws.rowCount).toBe(501) // 1 header + 500 data
  })

  it('columns with undefined values in data are handled gracefully', async () => {
    const data = makeTableData({
      profiles: [
        { id: 'p1', email: 'a@b.com' }, // missing most columns
      ],
    })

    const buffer = await buildExportWorkbook(data)
    const workbook = await parseWorkbook(buffer)
    const ws = workbook.getWorksheet('profiles')!

    expect(ws.getRow(2).getCell(1).value).toBe('p1')
    expect(ws.getRow(2).getCell(2).value).toBe('a@b.com')
    // Missing fields become empty
    expect(ws.getRow(2).getCell(3).value).toBe('')
  })

  it('returns a buffer that can be loaded as valid XLSX', async () => {
    const buffer = await buildExportWorkbook(makeTableData())
    expect(buffer).toBeDefined()
    expect(buffer.byteLength).toBeGreaterThan(0)

    // Should not throw when re-loading
    const workbook = new ExcelJS.Workbook()
    await expect(workbook.xlsx.load(buffer as ArrayBuffer)).resolves.not.toThrow()
  })

  it('sets workbook creator to Primap', async () => {
    const buffer = await buildExportWorkbook(makeTableData())
    const workbook = await parseWorkbook(buffer)
    expect(workbook.creator).toBe('Primap')
  })
})
