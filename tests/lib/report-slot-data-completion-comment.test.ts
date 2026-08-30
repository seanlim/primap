/**
 * Tests for completion_comment mapping in getSlotReportViewData.
 *
 * Covers: field mapping from DB snake_case to camelCase, null handling,
 * visibility across different observation statuses.
 */
import { describe, expect, it } from 'vitest'
import { getSlotReportViewData } from '@/lib/report-slot-data'

function createSingleQueryResult<T>(data: T) {
  return {
    select() { return this },
    eq() { return this },
    single() { return Promise.resolve({ data, error: null }) },
  }
}

function createOrderedQueryResult<T>(data: T) {
  return {
    select() { return this },
    eq() { return this },
    order() { return Promise.resolve({ data, error: null }) },
  }
}

function createMembershipQueryResult<T>(data: T) {
  return {
    select() { return this },
    eq() { return this },
    then(resolve: (value: { data: T; error: null }) => unknown) {
      return Promise.resolve(resolve({ data, error: null }))
    },
  }
}

const baseSlot = {
  id: 'slot-1',
  location_name: 'Forest Trail',
  walk_date: '2026-04-12',
  start_time: '08:00',
  end_time: '10:00',
  survey_rounds: { name: 'Round 1' },
}

const baseObservation = {
  walk_completion: 'COMPLETED' as 'COMPLETED' | 'PARTIAL' | 'ABORTED',
  completion_comment: null as string | null,
  outcome: 'NOT_SIGHTED' as 'SIGHTED' | 'NOT_SIGHTED',
  notes: null,
  lat: 1.3,
  lng: 103.8,
  status: 'SUBMITTED' as const,
  submitted_at: '2026-04-12T03:00:00Z',
  sightings: [],
  media: [],
}

const baseMembers = [
  { user_id: 'user-a', profiles: { full_name: 'User A', email: 'a@example.com' } },
]

function buildSupabase(observations: typeof baseObservation[], members: typeof baseMembers) {
  return {
    from(table: string) {
      if (table === 'walk_slots') return createSingleQueryResult(baseSlot)
      if (table === 'observations') return createOrderedQueryResult(observations)
      if (table === 'slot_memberships') return createMembershipQueryResult(members)
      if (table === 'incidents') return createOrderedQueryResult([])
      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('completion_comment in getSlotReportViewData', () => {
  it('maps completion_comment to completionComment for a PARTIAL observation', async () => {
    const obs = {
      ...baseObservation,
      id: 'obs-1',
      walk_completion: 'PARTIAL' as const,
      completion_comment: 'Rain forced early end',
    }
    const supabase = buildSupabase([obs], baseMembers)

    const result = await getSlotReportViewData(supabase as never, 'slot-1', 'admin-user')

    expect(result).not.toBeNull()
    expect(result!.observations.completionComment).toBe('Rain forced early end')
    expect(result!.observations.walkCompletion).toBe('PARTIAL')
  })

  it('maps completion_comment to completionComment for an ABORTED observation', async () => {
    const obs = {
      ...baseObservation,
      id: 'obs-1',
      walk_completion: 'ABORTED' as const,
      completion_comment: 'Trail flooded',
    }
    const supabase = buildSupabase([obs], baseMembers)

    const result = await getSlotReportViewData(supabase as never, 'slot-1', 'admin-user')

    expect(result!.observations.completionComment).toBe('Trail flooded')
    expect(result!.observations.walkCompletion).toBe('ABORTED')
  })

  it('returns null completionComment for COMPLETED observation', async () => {
    const obs = {
      ...baseObservation,
      id: 'obs-1',
      walk_completion: 'COMPLETED' as const,
      completion_comment: null,
    }
    const supabase = buildSupabase([obs], baseMembers)

    const result = await getSlotReportViewData(supabase as never, 'slot-1', 'admin-user')

    expect(result!.observations.completionComment).toBeNull()
  })

  it('preserves completionComment with special characters', async () => {
    const specialComment = 'Encountered <dangerous> situation & had to 撤退'
    const obs = {
      ...baseObservation,
      id: 'obs-1',
      walk_completion: 'ABORTED' as const,
      completion_comment: specialComment,
    }
    const supabase = buildSupabase([obs], baseMembers)

    const result = await getSlotReportViewData(supabase as never, 'slot-1', 'admin-user')

    expect(result!.observations.completionComment).toBe(specialComment)
  })

  it('returns null when slot not found (no observations mapped)', async () => {
    const supabase = {
      from(table: string) {
        if (table === 'walk_slots') return createSingleQueryResult(null)
        if (table === 'observations') return createOrderedQueryResult([])
        if (table === 'slot_memberships') return createMembershipQueryResult([])
        if (table === 'incidents') return createOrderedQueryResult([])
        throw new Error(`Unexpected table: ${table}`)
      },
    }

    const result = await getSlotReportViewData(supabase as never, 'slot-1', 'admin-user')

    expect(result).toBeNull()
  })
})
