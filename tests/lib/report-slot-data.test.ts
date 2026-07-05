import { describe, expect, it } from 'vitest'
import { getSlotReportViewData } from '@/lib/report-slot-data'

function createSingleQueryResult<T>(data: T) {
  return {
    select() {
      return this
    },
    eq() {
      return this
    },
    single() {
      return Promise.resolve({ data, error: null })
    },
  }
}

function createOrderedQueryResult<T>(data: T) {
  return {
    select() {
      return this
    },
    eq() {
      return this
    },
    order() {
      return Promise.resolve({ data, error: null })
    },
  }
}

// Mimics Supabase's .eq() filtering so callers can verify e.g. `.eq('status', 'ACTIVE')`
// behavior without needing a real query engine. Filters on columns absent from a row
// (e.g. `slot_id`, which isn't modeled on these membership fixtures) are ignored.
function createMembershipQueryResult<T extends Record<string, unknown>[]>(data: T) {
  const filters: Record<string, unknown> = {}
  return {
    select() {
      return this
    },
    eq(column: string, value: unknown) {
      filters[column] = value
      return this
    },
    then(resolve: (value: { data: T; error: null }) => unknown) {
      const filtered = data.filter((row) =>
        Object.entries(filters).every(([key, value]) => !(key in row) || row[key] === value)
      ) as T
      return Promise.resolve(resolve({ data: filtered, error: null }))
    },
  }
}

describe('getSlotReportViewData', () => {
  it('shows a draft observation for an active member but hides it for a cancelled member', async () => {
    const buildSupabase = () => ({
      from(table: string) {
        if (table === 'walk_slots') {
          return createSingleQueryResult({
            id: 'slot-1',
            location_name: 'Forest Trail',
            walk_date: '2026-04-12',
            start_time: '08:00',
            end_time: '10:00',
            survey_rounds: { name: 'Round 1' },
          })
        }

        if (table === 'observations') {
          return createOrderedQueryResult([
            {
              id: 'obs-draft',
              walk_completion: 'PARTIAL',
              outcome: 'NOT_SIGHTED',
              notes: 'Current draft',
              lat: 1.31,
              lng: 103.81,
              status: 'DRAFT',
              submitted_at: null,
              sightings: [],
              media: [],
            },
          ])
        }

        if (table === 'slot_memberships') {
          return createMembershipQueryResult([
            {
              user_id: 'user-active',
              status: 'ACTIVE',
              profiles: { full_name: 'User Active', email: 'active@example.com' },
            },
            {
              user_id: 'user-cancelled',
              status: 'CANCELLED',
              profiles: { full_name: 'User Cancelled', email: 'cancelled@example.com' },
            },
          ])
        }

        if (table === 'incidents') {
          return createOrderedQueryResult([])
        }

        throw new Error(`Unexpected table: ${table}`)
      },
    })

    const activeResult = await getSlotReportViewData(buildSupabase() as never, 'slot-1', 'user-active')
    expect(activeResult?.isParticipant).toBe(true)
    expect(activeResult?.observations).toMatchObject({ id: 'obs-draft', status: 'DRAFT' })

    const cancelledResult = await getSlotReportViewData(buildSupabase() as never, 'slot-1', 'user-cancelled')
    expect(cancelledResult?.isParticipant).toBe(false)
    expect(cancelledResult?.observations).toBeUndefined()
  })

  it('maps participant visibility, name fallbacks, and incident media correctly', async () => {
    const supabase = {
      from(table: string) {
        if (table === 'walk_slots') {
          return createSingleQueryResult({
            id: 'slot-1',
            location_name: 'Forest Trail',
            walk_date: '2026-04-12',
            start_time: '08:00',
            end_time: '10:00',
            survey_rounds: { name: 'Round 1' },
          })
        }

        if (table === 'observations') {
          return createOrderedQueryResult([
            {
              id: 'obs-submitted-self',
              walk_completion: 'COMPLETED',
              completion_comment: null,
              outcome: 'SIGHTED',
              notes: 'Submitted by participant',
              lat: 1.3,
              lng: 103.8,
              status: 'SUBMITTED',
              submitted_at: '2026-04-12T03:00:00Z',
              sightings: [
                {
                  id: 's-1',
                  species: 'RBL',
                  species_other: null,
                  count: '2',
                  observed_at: '2026-04-12T08:30:00Z',
                  lat: 1.301,
                  lng: 103.801,
                  notes: 'Near boardwalk',
                  media: [],
                },
              ],
              media: [],
            },
          ])
        }

        if (table === 'slot_memberships') {
          return createMembershipQueryResult([
            {
              user_id: 'user-self',
              status: 'ACTIVE',
              profiles: { full_name: null, email: 'self@example.com' },
            },
          ])
        }

        if (table === 'incidents') {
          return createOrderedQueryResult([
            {
              id: 'incident-1',
              incident_type: 'WEATHER',
              description: 'Heavy rain',
              resolved: false,
              created_at: '2026-04-12T04:00:00Z',
              profiles: { full_name: null, email: 'reporter@example.com' },
              media: [
                {
                  id: 'media-1',
                  file_path: 'incidents/rain.jpg',
                  file_name: 'rain.jpg',
                  media_type: 'image/jpeg',
                },
              ],
            },
          ])
        }

        throw new Error(`Unexpected table: ${table}`)
      },
    }

    const result = await getSlotReportViewData(supabase as never, 'slot-1', 'user-self')

    expect(result).not.toBeNull()
    expect(result?.isParticipant).toBe(true)
    expect(result?.hasSubmittedOwnObservation).toBe(true)
    expect(result?.observations).toMatchObject({
      userName: 'self@example.com',
      completionComment: null,
      sightings: [
        expect.objectContaining({
          species: 'RBL',
          media: [],
        }),
      ],
    })
    expect(result?.members).toEqual([
      {
        userId: 'user-self',
        fullName: null,
        email: 'self@example.com',
      },
    ])
    expect(result?.incidents).toEqual([
      {
        id: 'incident-1',
        type: 'WEATHER',
        description: 'Heavy rain',
        reportedBy: 'reporter@example.com',
        createdAt: '2026-04-12T04:00:00Z',
        resolved: false,
        media: [
          {
            id: 'media-1',
            file_path: 'incidents/rain.jpg',
            file_name: 'rain.jpg',
            media_type: 'image/jpeg',
          },
        ],
      },
    ])
  })

  it('returns empty collections and false flags when related query data is null', async () => {
    const supabase = {
      from(table: string) {
        if (table === 'walk_slots') {
          return createSingleQueryResult({
            id: 'slot-1',
            location_name: 'Forest Trail',
            walk_date: '2026-04-12',
            start_time: '08:00',
            end_time: '10:00',
            survey_rounds: { name: 'Round 1' },
          })
        }

        if (table === 'observations') {
          return createOrderedQueryResult(null)
        }

        if (table === 'slot_memberships') {
          return createMembershipQueryResult([])
        }

        if (table === 'incidents') {
          return createOrderedQueryResult(null)
        }

        throw new Error(`Unexpected table: ${table}`)
      },
    }

    const result = await getSlotReportViewData(supabase as never, 'slot-1', 'outsider')

    expect(result).not.toBeNull()
    expect(result?.observations).toBeUndefined()
    expect(result?.members).toEqual([])
    expect(result?.incidents).toEqual([])
    expect(result?.isParticipant).toBe(false)
    expect(result?.hasSubmittedOwnObservation).toBe(false)
  })
})
