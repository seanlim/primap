import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Hoisted mocks ---

const {
  mockGetUser,
  mockAuthProfileSingle,
  mockValidate,
  mockAdminFrom,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockAuthProfileSingle: vi.fn(),
  mockValidate: vi.fn(),
  mockAdminFrom: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockAuthProfileSingle,
    }),
  })),
}))

vi.mock('@/lib/export-import/import-validators', () => ({
  validateLegacyWorkbook: (...args: unknown[]) => mockValidate(...args),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
  })),
}))

import { POST } from '@/app/api/admin/import-legacy/route'

function makeRequest(hasFile: boolean = true) {
  const fakeFile = hasFile ? {
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
  } : null

  return {
    formData: vi.fn().mockResolvedValue({
      get: vi.fn((key: string) => (key === 'file' ? fakeFile : null)),
    }),
  } as unknown as Parameters<typeof POST>[0]
}

function makeEmptyRequest() {
  return makeRequest(false)
}

function setupAdminMocks() {
  // Rounds lookup
  const roundsSelect = vi.fn().mockResolvedValue({
    data: [{ id: 'r1', name: 'Round 1' }],
    error: null,
  })

  // Profiles lookup
  const profilesSelect = vi.fn().mockResolvedValue({
    data: [{ id: 'u1', email: 'alice@test.com' }],
    error: null,
  })

  // Walk slot lookup (existing)
  const walkSlotMaybeSingle = vi.fn().mockResolvedValue({
    data: { id: 'ws1' },
    error: null,
  })

  // Slot membership lookup (not existing)
  const membershipMaybeSingle = vi.fn().mockResolvedValue({
    data: null,
    error: null,
  })

  // Insert results
  const membershipInsert = vi.fn().mockResolvedValue({ error: null })
  const observationInsertSingle = vi.fn().mockResolvedValue({
    data: { id: 'obs1' },
    error: null,
  })
  const sightingInsert = vi.fn().mockResolvedValue({ error: null })

  mockAdminFrom.mockImplementation((table: string) => {
    switch (table) {
      case 'survey_rounds':
        return { select: roundsSelect }
      case 'profiles':
        return { select: profilesSelect }
      case 'walk_slots':
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      maybeSingle: walkSlotMaybeSingle,
                    }),
                  }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'ws-new' }, error: null }),
            }),
          }),
        }
      case 'slot_memberships':
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: membershipMaybeSingle,
              }),
            }),
          }),
          insert: membershipInsert.mockResolvedValue({ error: null }),
        }
      case 'observations':
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: observationInsertSingle,
            }),
          }),
        }
      case 'sightings':
        return {
          insert: sightingInsert.mockResolvedValue({ error: null }),
        }
      default:
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) }
    }
  })

  return {
    walkSlotMaybeSingle,
    membershipMaybeSingle,
    membershipInsert,
    observationInsertSingle,
    sightingInsert,
  }
}

describe('POST /api/admin/import-legacy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const response = await POST(makeRequest())
    expect(response.status).toBe(401)
  })

  it('returns 403 when not admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockAuthProfileSingle.mockResolvedValue({ data: { role: 'VOLUNTEER' } })

    const response = await POST(makeRequest())
    expect(response.status).toBe(403)
  })

  it('returns 400 when no file provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockAuthProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    const response = await POST(makeEmptyRequest())
    expect(response.status).toBe(400)
  })

  it('returns 400 with errors when validation fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockAuthProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockValidate.mockResolvedValue({
      rows: [],
      errors: [
        { row: 2, column: 'outcome', message: 'Invalid outcome: "BAD"' },
        { row: 3, column: 'observer_email', message: 'Email not found' },
      ],
    })

    const response = await POST(makeRequest())

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Validation failed')
    expect(body.errors).toHaveLength(2)
    expect(body.errors[0].row).toBe(2)
    expect(body.errors[1].row).toBe(3)
  })

  it('returns success with summary for valid data', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockAuthProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    mockValidate.mockResolvedValue({
      rows: [{
        round_name: 'Round 1',
        location_name: 'Park A',
        walk_date: '2026-03-15',
        start_time: '08:00',
        end_time: '10:00',
        observer_email: 'alice@test.com',
        walk_completion: 'COMPLETED',
        outcome: 'NOT_SIGHTED',
        observation_notes: null,
        observation_lat: 1.3,
        observation_lng: 103.8,
        species: null,
        count: null,
      }],
      errors: [],
    })

    setupAdminMocks()

    const response = await POST(makeRequest())

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.summary.rows_processed).toBe(1)
    expect(body.summary.observations_created).toBe(1)
  })

  it('creates sightings when outcome is SIGHTED', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockAuthProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    mockValidate.mockResolvedValue({
      rows: [{
        round_name: 'Round 1',
        location_name: 'Park A',
        walk_date: '2026-03-15',
        start_time: '08:00',
        end_time: '10:00',
        observer_email: 'alice@test.com',
        walk_completion: 'COMPLETED',
        outcome: 'SIGHTED',
        observation_notes: null,
        observation_lat: 1.3,
        observation_lng: 103.8,
        species: 'RBL',
        count: '3',
        sighting_lat: 1.35,
        sighting_lng: 103.82,
        observed_at: '2026-03-15T09:00:00Z',
        sighting_notes: 'Adult with juvenile',
      }],
      errors: [],
    })

    const mocks = setupAdminMocks()

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(body.success).toBe(true)
    expect(body.summary.sightings_created).toBe(1)
  })

  it('does not create sightings when outcome is NOT_SIGHTED', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockAuthProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    mockValidate.mockResolvedValue({
      rows: [{
        round_name: 'Round 1',
        location_name: 'Park A',
        walk_date: '2026-03-15',
        start_time: '08:00',
        end_time: '10:00',
        observer_email: 'alice@test.com',
        walk_completion: 'COMPLETED',
        outcome: 'NOT_SIGHTED',
        species: null,
      }],
      errors: [],
    })

    setupAdminMocks()

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(body.summary.sightings_created).toBe(0)
  })

  it('handles multiple rows and tracks summary correctly', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockAuthProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })

    mockValidate.mockResolvedValue({
      rows: [
        {
          round_name: 'Round 1', location_name: 'Park A', walk_date: '2026-03-15',
          start_time: '08:00', end_time: '10:00', observer_email: 'alice@test.com',
          walk_completion: 'COMPLETED', outcome: 'SIGHTED', species: 'RBL', count: '2',
        },
        {
          round_name: 'Round 1', location_name: 'Park A', walk_date: '2026-03-15',
          start_time: '08:00', end_time: '10:00', observer_email: 'alice@test.com',
          walk_completion: 'COMPLETED', outcome: 'NOT_SIGHTED', species: null,
        },
      ],
      errors: [],
    })

    setupAdminMocks()

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(body.summary.rows_processed).toBe(2)
    expect(body.summary.observations_created).toBe(2)
    expect(body.summary.sightings_created).toBe(1) // only first row is SIGHTED
  })

  it('returns 500 on unexpected errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockAuthProfileSingle.mockResolvedValue({ data: { role: 'ADMIN' } })
    mockValidate.mockRejectedValue(new Error('Unexpected parse error'))

    const response = await POST(makeRequest())

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Unexpected parse error')
  })
})
