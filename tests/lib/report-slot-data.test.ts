import { describe, expect, it } from 'vitest'
import { getSlotReportViewData } from '@/lib/report-slot-data'

function createQueryResult<T>(data: T) {
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
    single() {
      return Promise.resolve({ data, error: null })
    },
  }
}

describe('getSlotReportViewData', () => {
  it('hides drafts that belong to users who are no longer active members', async () => {
    const supabase = {
      from(table: string) {
        if (table === 'walk_slots') {
          return createQueryResult({
            id: 'slot-1',
            location_name: 'Forest Trail',
            walk_date: '2026-04-12',
            start_time: '08:00',
            end_time: '10:00',
            survey_rounds: { name: 'Round 1' },
          })
        }

        if (table === 'observations') {
          return createQueryResult([
            {
              id: 'obs-draft-cancelled',
              user_id: 'user-a',
              walk_completion: 'COMPLETED',
              outcome: 'NOT_SIGHTED',
              notes: 'Old draft',
              lat: 1.3,
              lng: 103.8,
              status: 'DRAFT',
              submitted_at: null,
              profiles: { full_name: 'User A', email: 'a@example.com', avatar_url: null },
              sightings: [],
              media: [],
            },
            {
              id: 'obs-submitted-active',
              user_id: 'user-b',
              walk_completion: 'COMPLETED',
              outcome: 'SIGHTED',
              notes: 'Submitted report',
              lat: null,
              lng: null,
              status: 'SUBMITTED',
              submitted_at: '2026-04-12T03:00:00Z',
              profiles: { full_name: 'User B', email: 'b@example.com', avatar_url: null },
              sightings: [],
              media: [],
            },
          ])
        }

        if (table === 'slot_memberships') {
          return createQueryResult([
            {
              user_id: 'user-b',
              profiles: { full_name: 'User B', email: 'b@example.com' },
            },
          ])
        }

        if (table === 'incidents') {
          return createQueryResult([])
        }

        throw new Error(`Unexpected table: ${table}`)
      },
    }

    const result = await getSlotReportViewData(supabase as never, 'slot-1', 'admin-user')

    expect(result).not.toBeNull()
    expect(result?.observations).toHaveLength(1)
    expect(result?.observations[0]).toMatchObject({
      id: 'obs-submitted-active',
      userId: 'user-b',
      status: 'SUBMITTED',
    })
  })
})
