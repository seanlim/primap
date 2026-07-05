import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { parseWorkbookToTableData, parseSheetRows } from '@/lib/export-import/import-workbook'

async function createTestWorkbook(
  sheets: Record<string, { headers: string[]; rows: unknown[][] }>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  for (const [name, { headers, rows }] of Object.entries(sheets)) {
    const ws = workbook.addWorksheet(name)
    ws.addRow(headers)
    for (const row of rows) {
      ws.addRow(row)
    }
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

describe('parseWorkbookToTableData', () => {
  it('parses multiple sheets into a record keyed by sheet name', async () => {
    const buffer = await createTestWorkbook({
      profiles: {
        headers: ['id', 'email', 'full_name'],
        rows: [['p1', 'alice@test.com', 'Alice']],
      },
      survey_rounds: {
        headers: ['id', 'name'],
        rows: [['r1', 'Round 1']],
      },
    })

    const result = await parseWorkbookToTableData(buffer)

    expect(Object.keys(result)).toContain('profiles')
    expect(Object.keys(result)).toContain('survey_rounds')
    expect(result.profiles).toHaveLength(1)
    expect(result.profiles[0].id).toBe('p1')
    expect(result.survey_rounds[0].name).toBe('Round 1')
  })

  it('handles workbook with empty sheets', async () => {
    const buffer = await createTestWorkbook({
      empty_table: {
        headers: ['id', 'name'],
        rows: [],
      },
    })

    const result = await parseWorkbookToTableData(buffer)
    expect(result.empty_table).toEqual([])
  })

  it('maps worksheet aliases back to table names', async () => {
    const buffer = await createTestWorkbook({
      round_participation_reqs: {
        headers: ['id', 'user_id', 'round_id'],
        rows: [['req-1', 'user-1', 'round-1']],
      },
    })

    const result = await parseWorkbookToTableData(buffer)

    expect(result.round_participation_requirements).toHaveLength(1)
    expect(result.round_participation_requirements[0].id).toBe('req-1')
  })

  it('handles workbook with no sheets', async () => {
    const workbook = new ExcelJS.Workbook()
    const arrayBuffer = await workbook.xlsx.writeBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const result = await parseWorkbookToTableData(buffer)
    expect(Object.keys(result)).toHaveLength(0)
  })
})

describe('parseSheetRows', () => {
  function createWorksheet(headers: string[], rows: unknown[][]): ExcelJS.Worksheet {
    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet('test')
    ws.addRow(headers)
    for (const row of rows) {
      ws.addRow(row)
    }
    return ws
  }

  it('parses basic rows correctly', () => {
    const ws = createWorksheet(
      ['id', 'name', 'value'],
      [
        ['1', 'Alice', 42],
        ['2', 'Bob', 100],
      ]
    )

    const rows = parseSheetRows(ws)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ id: '1', name: 'Alice', value: 42 })
    expect(rows[1]).toEqual({ id: '2', name: 'Bob', value: 100 })
  })

  it('converts null/undefined/empty cell values to null', () => {
    const ws = createWorksheet(
      ['id', 'name', 'notes'],
      [['1', 'Alice', null]],
    )

    const rows = parseSheetRows(ws)
    expect(rows[0].notes).toBeNull()
  })

  it('preserves numeric values', () => {
    const ws = createWorksheet(
      ['id', 'lat', 'lng'],
      [['1', 1.234, -5.678]],
    )

    const rows = parseSheetRows(ws)
    expect(rows[0].lat).toBe(1.234)
    expect(rows[0].lng).toBe(-5.678)
  })

  it('preserves boolean values', () => {
    const ws = createWorksheet(
      ['id', 'resolved'],
      [
        ['1', true],
        ['2', false],
      ],
    )

    const rows = parseSheetRows(ws)
    expect(rows[0].resolved).toBe(true)
    expect(rows[1].resolved).toBe(false)
  })

  it('converts Date objects to ISO strings', () => {
    const date = new Date('2026-03-15T10:30:00Z')
    const ws = createWorksheet(
      ['id', 'created_at'],
      [['1', date]],
    )

    const rows = parseSheetRows(ws)
    expect(typeof rows[0].created_at).toBe('string')
    expect(rows[0].created_at).toBe(date.toISOString())
  })

  it('skips entirely empty rows', () => {
    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet('test')
    ws.addRow(['id', 'name'])
    ws.addRow(['1', 'Alice'])
    ws.addRow([null, null]) // empty row
    ws.addRow(['2', 'Bob'])

    const rows = parseSheetRows(ws)
    expect(rows).toHaveLength(2)
    expect(rows[0].id).toBe('1')
    expect(rows[1].id).toBe('2')
  })

  it('returns empty array for sheet with only headers', () => {
    const ws = createWorksheet(['id', 'name'], [])
    const rows = parseSheetRows(ws)
    expect(rows).toEqual([])
  })

  it('handles headers with extra whitespace', () => {
    const ws = createWorksheet(
      ['  id  ', ' name '],
      [['1', 'Alice']],
    )

    const rows = parseSheetRows(ws)
    expect(rows[0]).toHaveProperty('id')
    expect(rows[0]).toHaveProperty('name')
  })

  it('handles rows with fewer cells than headers', () => {
    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet('test')
    ws.addRow(['id', 'name', 'email'])
    ws.addRow(['1', 'Alice']) // missing email

    const rows = parseSheetRows(ws)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('1')
    expect(rows[0].name).toBe('Alice')
    // email column not set in the row, so it won't appear
  })

  it('handles many rows efficiently', () => {
    const headers = ['id', 'value']
    const dataRows = Array.from({ length: 1000 }, (_, i) => [`id-${i}`, i])

    const ws = createWorksheet(headers, dataRows)
    const rows = parseSheetRows(ws)

    expect(rows).toHaveLength(1000)
    expect(rows[0].id).toBe('id-0')
    expect(rows[999].id).toBe('id-999')
  })
})
