import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'
import { validateLegacyWorkbook } from '@/lib/export-import/import-validators'
import { LEGACY_REQUIRED_COLUMNS } from '@/lib/export-import/constants'

const ALL_HEADERS = [
  'round_name', 'location_name', 'walk_date', 'start_time', 'end_time',
  'observer_email', 'walk_completion', 'outcome',
  'observation_notes', 'observation_lat', 'observation_lng',
  'species', 'count', 'sighting_lat', 'sighting_lng', 'observed_at', 'sighting_notes',
]

function makeValidRow(overrides: Record<string, unknown> = {}): unknown[] {
  const defaults: Record<string, unknown> = {
    round_name: 'Round 1',
    location_name: 'Park A',
    walk_date: '2026-03-15',
    start_time: '08:00',
    end_time: '10:00',
    observer_email: 'alice@test.com',
    walk_completion: 'COMPLETED',
    outcome: 'NOT_SIGHTED',
    observation_notes: '',
    observation_lat: 1.3,
    observation_lng: 103.8,
    species: '',
    count: '',
    sighting_lat: '',
    sighting_lng: '',
    observed_at: '',
    sighting_notes: '',
  }
  const merged = { ...defaults, ...overrides }
  return ALL_HEADERS.map(h => merged[h] ?? '')
}

async function createLegacyWorkbook(
  headers: string[],
  rows: unknown[][]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('observations')
  ws.addRow(headers)
  for (const row of rows) {
    ws.addRow(row)
  }
  const buf = await workbook.xlsx.writeBuffer()
  return Buffer.from(buf)
}

function createMockAdminClient(
  profiles: { email: string }[] = [{ email: 'alice@test.com' }],
  rounds: { name: string }[] = [{ name: 'Round 1' }]
) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockResolvedValue({ data: profiles, error: null }) }
      }
      if (table === 'survey_rounds') {
        return { select: vi.fn().mockResolvedValue({ data: rounds, error: null }) }
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) }
    }),
  } as unknown as Parameters<typeof validateLegacyWorkbook>[1]
}

describe('validateLegacyWorkbook', () => {
  describe('header validation', () => {
    it('passes with all required headers present', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [makeValidRow()])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors).toHaveLength(0)
    })

    it('fails when a required column is missing', async () => {
      const headersWithout = ALL_HEADERS.filter(h => h !== 'outcome')
      const buffer = await createLegacyWorkbook(headersWithout, [['a']])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toContain('outcome')
    })

    it('fails when multiple required columns are missing', async () => {
      const headersWithout = ALL_HEADERS.filter(
        h => h !== 'outcome' && h !== 'walk_date' && h !== 'observer_email'
      )
      const buffer = await createLegacyWorkbook(headersWithout, [['a']])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.length).toBe(3)
      const messages = errors.map(e => e.message)
      expect(messages.some(m => m.includes('outcome'))).toBe(true)
      expect(messages.some(m => m.includes('walk_date'))).toBe(true)
      expect(messages.some(m => m.includes('observer_email'))).toBe(true)
    })

    it('accepts case-insensitive headers', async () => {
      const uppercaseHeaders = ALL_HEADERS.map(h => h.toUpperCase())
      const buffer = await createLegacyWorkbook(uppercaseHeaders, [makeValidRow()])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      // Headers are lowercased internally, so required check should pass
      expect(errors.filter(e => e.message.includes('Missing required'))).toHaveLength(0)
    })
  })

  describe('row validation', () => {
    it('passes for a fully valid row', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [makeValidRow()])
      const client = createMockAdminClient()

      const { rows, errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors).toHaveLength(0)
      expect(rows).toHaveLength(1)
    })

    it('fails when required field is empty', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ walk_completion: '' }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.column === 'walk_completion')).toBe(true)
    })

    it('fails for invalid outcome enum value', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ outcome: 'MAYBE' }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.column === 'outcome' && e.message.includes('MAYBE'))).toBe(true)
    })

    it('fails for invalid walk_completion enum value', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ walk_completion: 'CANCELLED' }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.column === 'walk_completion')).toBe(true)
    })

    it('fails for invalid species enum value', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ outcome: 'SIGHTED', species: 'MONKEY' }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.column === 'species' && e.message.includes('MONKEY'))).toBe(true)
    })

    it('requires species when outcome is SIGHTED', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ outcome: 'SIGHTED', species: '' }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.column === 'species' && e.message.includes('required'))).toBe(true)
    })

    it('does not require species when outcome is NOT_SIGHTED', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ outcome: 'NOT_SIGHTED', species: '' }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.filter(e => e.column === 'species')).toHaveLength(0)
    })

    it('accepts valid species values: RBL, LTM, DUSKY', async () => {
      for (const species of ['RBL', 'LTM', 'DUSKY']) {
        const buffer = await createLegacyWorkbook(ALL_HEADERS, [
          makeValidRow({ outcome: 'SIGHTED', species }),
        ])
        const client = createMockAdminClient()

        const { errors } = await validateLegacyWorkbook(buffer, client)
        expect(errors.filter(e => e.column === 'species')).toHaveLength(0)
      }
    })
  })

  describe('email validation', () => {
    it('fails when observer_email is not found in profiles', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ observer_email: 'unknown@test.com' }),
      ])
      const client = createMockAdminClient([{ email: 'alice@test.com' }])

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.column === 'observer_email' && e.message.includes('not found'))).toBe(true)
    })

    it('validates email case-insensitively', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ observer_email: 'ALICE@TEST.COM' }),
      ])
      const client = createMockAdminClient([{ email: 'alice@test.com' }])

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.filter(e => e.column === 'observer_email')).toHaveLength(0)
    })
  })

  describe('round validation', () => {
    it('fails when round_name is not found in survey_rounds', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ round_name: 'Nonexistent Round' }),
      ])
      const client = createMockAdminClient(
        [{ email: 'alice@test.com' }],
        [{ name: 'Round 1' }]
      )

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.column === 'round_name' && e.message.includes('not found'))).toBe(true)
    })
  })

  describe('date validation', () => {
    it('accepts valid YYYY-MM-DD date format', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ walk_date: '2026-03-15' }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.filter(e => e.column === 'walk_date')).toHaveLength(0)
    })

    it('fails for invalid date format', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ walk_date: 'not-a-date' }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.column === 'walk_date' && e.message.includes('Invalid date'))).toBe(true)
    })
  })

  describe('coordinate validation', () => {
    it('accepts valid numeric coordinates', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ observation_lat: 1.3521, observation_lng: 103.8198 }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.filter(e => e.column?.includes('lat') || e.column?.includes('lng'))).toHaveLength(0)
    })

    it('fails for non-numeric latitude', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ observation_lat: 'abc' }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.column === 'observation_lat' && e.message.includes('number'))).toBe(true)
    })

    it('fails for non-numeric longitude', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ observation_lng: 'xyz' }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.column === 'observation_lng' && e.message.includes('number'))).toBe(true)
    })

    it('accepts empty coordinate fields (optional) for NOT_SIGHTED', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ observation_lat: '', observation_lng: '' }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.filter(e => e.column?.includes('lat') || e.column?.includes('lng'))).toHaveLength(0)
    })

    it('accepts negative coordinates', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ observation_lat: -33.87, observation_lng: -151.21 }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.filter(e => e.column?.includes('lat') || e.column?.includes('lng'))).toHaveLength(0)
    })

    it('accepts zero as a valid coordinate', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({ outcome: 'SIGHTED', species: 'RBL', observation_lat: 0, observation_lng: 0 }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.filter(e => e.column === 'sighting_lat')).toHaveLength(0)
    })
  })

  describe('SIGHTED coordinate requirement', () => {
    it('fails when SIGHTED with no coordinates at all', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({
          outcome: 'SIGHTED',
          species: 'RBL',
          observation_lat: '',
          observation_lng: '',
          sighting_lat: '',
          sighting_lng: '',
        }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.column === 'sighting_lat' && e.message.includes('Coordinates are required'))).toBe(true)
    })

    it('fails when SIGHTED with null coordinates', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({
          outcome: 'SIGHTED',
          species: 'RBL',
          observation_lat: null,
          observation_lng: null,
          sighting_lat: null,
          sighting_lng: null,
        }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.column === 'sighting_lat' && e.message.includes('Coordinates are required'))).toBe(true)
    })

    it('passes when SIGHTED with only observation coordinates', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({
          outcome: 'SIGHTED',
          species: 'RBL',
          observation_lat: 1.3,
          observation_lng: 103.8,
          sighting_lat: '',
          sighting_lng: '',
        }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.filter(e => e.column === 'sighting_lat')).toHaveLength(0)
    })

    it('passes when SIGHTED with only sighting coordinates', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({
          outcome: 'SIGHTED',
          species: 'RBL',
          observation_lat: '',
          observation_lng: '',
          sighting_lat: 1.35,
          sighting_lng: 103.82,
        }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.filter(e => e.column === 'sighting_lat')).toHaveLength(0)
    })

    it('passes when SIGHTED with both coordinate pairs', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({
          outcome: 'SIGHTED',
          species: 'RBL',
          observation_lat: 1.3,
          observation_lng: 103.8,
          sighting_lat: 1.35,
          sighting_lng: 103.82,
        }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.filter(e => e.column === 'sighting_lat')).toHaveLength(0)
    })

    it('does not require coordinates when NOT_SIGHTED', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({
          outcome: 'NOT_SIGHTED',
          observation_lat: '',
          observation_lng: '',
          sighting_lat: '',
          sighting_lng: '',
        }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.filter(e => e.message.includes('Coordinates are required'))).toHaveLength(0)
    })

    it('fails when SIGHTED with only one of the sighting pair', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({
          outcome: 'SIGHTED',
          species: 'RBL',
          observation_lat: '',
          observation_lng: '',
          sighting_lat: 1.35,
          sighting_lng: '',
        }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.column === 'sighting_lat' && e.message.includes('Coordinates are required'))).toBe(true)
    })

    it('fails when SIGHTED with only one of the observation pair', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({
          outcome: 'SIGHTED',
          species: 'RBL',
          observation_lat: 1.3,
          observation_lng: '',
          sighting_lat: '',
          sighting_lng: '',
        }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.column === 'sighting_lat' && e.message.includes('Coordinates are required'))).toBe(true)
    })

    it('fails when SIGHTED with non-numeric coordinate values only', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({
          outcome: 'SIGHTED',
          species: 'RBL',
          observation_lat: 'abc',
          observation_lng: 'xyz',
          sighting_lat: '',
          sighting_lng: '',
        }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      // Should have both "must be a number" errors AND "Coordinates are required" error
      expect(errors.some(e => e.column === 'observation_lat' && e.message.includes('number'))).toBe(true)
      expect(errors.some(e => e.column === 'sighting_lat' && e.message.includes('Coordinates are required'))).toBe(true)
    })
  })

  describe('multiple row validation', () => {
    it('reports errors for each invalid row with correct row numbers', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow(), // row 2 - valid
        makeValidRow({ outcome: 'INVALID' }), // row 3 - invalid
        makeValidRow(), // row 4 - valid
        makeValidRow({ observer_email: 'bad@email.com' }), // row 5 - invalid
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.row === 3)).toBe(true)
      expect(errors.some(e => e.row === 5)).toBe(true)
      expect(errors.every(e => e.row !== 2 && e.row !== 4)).toBe(true)
    })

    it('collects all errors from a single row', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [
        makeValidRow({
          outcome: 'INVALID',
          walk_completion: 'BAD',
          observer_email: 'nobody@nowhere.com',
        }),
      ])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('edge cases', () => {
    it('returns error for empty workbook (no worksheet)', async () => {
      const workbook = new ExcelJS.Workbook()
      const buf = Buffer.from(await workbook.xlsx.writeBuffer())
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buf, client)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].message).toContain('No worksheet')
    })

    it('returns error for workbook with only headers (no data rows)', async () => {
      const buffer = await createLegacyWorkbook(ALL_HEADERS, [])
      const client = createMockAdminClient()

      const { errors } = await validateLegacyWorkbook(buffer, client)
      expect(errors.some(e => e.message.includes('No data rows'))).toBe(true)
    })
  })
})
