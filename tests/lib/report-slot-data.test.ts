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

function createMembershipQueryResult<T>(data: T) {
  return {
    select() {
      return this
    },
    eq() {
      return this
    },
    then(resolve: (value: { data: T; error: null }) => unknown) {
      return Promise.resolve(resolve({ data, error: null }))
    },
  }
}

describe('getSlotReportViewData', () => {
  it('shows drafts for active members but hides drafts for cancelled members', async () => {
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
              id: 'obs-draft-active',
              user_id: 'user-b',
              walk_completion: 'PARTIAL',
              outcome: 'NOT_SIGHTED',
              notes: 'Current active draft',
              lat: 1.31,
              lng: 103.81,
              status: 'DRAFT',
              submitted_at: null,
              profiles: { full_name: 'User B', email: 'b@example.com', avatar_url: null },
              sightings: [],
              media: [],
            },
            {
              id: 'obs-submitted-active',
              user_id: 'user-c',
              walk_completion: 'COMPLETED',
              outcome: 'SIGHTED',
              notes: 'Submitted report',
              lat: null,
              lng: null,
              status: 'SUBMITTED',
              submitted_at: '2026-04-12T03:00:00Z',
              profiles: { full_name: 'User C', email: 'c@example.com', avatar_url: null },
              sightings: [],
              media: [],
            },
          ])
        }

        if (table === 'slot_memberships') {
          return createMembershipQueryResult([
            {
              user_id: 'user-b',
              profiles: { full_name: 'User B', email: 'b@example.com' },
            },
            {
              user_id: 'user-c',
              profiles: { full_name: 'User C', email: 'c@example.com' },
            },
          ])
        }

        if (table === 'incidents') {
          return createOrderedQueryResult([])
        }

        throw new Error(`Unexpected table: ${table}`)
      },
    }

    const result = await getSlotReportViewData(supabase as never, 'slot-1', 'admin-user')

    expect(result).not.toBeNull()
    expect(result?.observations.map((observation) => observation.id)).toEqual([
      'obs-draft-active',
      'obs-submitted-active',
    ])
    expect(result?.observations.find((observation) => observation.id === 'obs-draft-active')).toMatchObject({
      userId: 'user-b',
      status: 'DRAFT',
    })
    expect(result?.observations.find((observation) => observation.id === 'obs-draft-cancelled')).toBeUndefined()
  })
})
