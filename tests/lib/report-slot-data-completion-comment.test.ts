/**
 * Tests for completion_comment mapping in getSlotReportViewData.
 *
 * Covers: field mapping from DB snake_case to camelCase, null handling,
 * visibility across different observation statuses, mixed observations.
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
  user_id: 'user-a',
  walk_completion: 'COMPLETED' as const,
  completion_comment: null as string | null,
  outcome: 'NOT_SIGHTED' as const,
  notes: null,
  lat: 1.3,
  lng: 103.8,
  status: 'SUBMITTED' as const,
  submitted_at: '2026-04-12T03:00:00Z',
  profiles: { full_name: 'User A', email: 'a@example.com', avatar_url: null },
  sightings: [],
  media: [],
}

function buildSupabase(observations: typeof baseObservation[]) {
  return {
    from(table: string) {
      if (table === 'walk_slots') return createSingleQueryResult(baseSlot)
      if (table === 'observations') return createOrderedQueryResult(observations)
      if (table === 'slot_memberships') {
        return createMembershipQueryResult(
          observations.map(o => ({
            user_id: o.user_id,
            profiles: { full_name: o.profiles.full_name, email: o.profiles.email },
          }))
        )
      }
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
    const supabase = buildSupabase([obs])

    const result = await getSlotReportViewData(supabase as never, 'slot-1', 'admin-user')

    expect(result).not.toBeNull()
    expect(result!.observations).toHaveLength(1)
    expect(result!.observations[0].completionComment).toBe('Rain forced early end')
    expect(result!.observations[0].walkCompletion).toBe('PARTIAL')
  })

  it('maps completion_comment to completionComment for an ABORTED observation', async () => {
    const obs = {
      ...baseObservation,
      id: 'obs-1',
      walk_completion: 'ABORTED' as const,
      completion_comment: 'Trail flooded',
    }
    const supabase = buildSupabase([obs])

    const result = await getSlotReportViewData(supabase as never, 'slot-1', 'admin-user')

    expect(result!.observations[0].completionComment).toBe('Trail flooded')
    expect(result!.observations[0].walkCompletion).toBe('ABORTED')
  })

  it('returns null completionComment for COMPLETED observation', async () => {
    const obs = {
      ...baseObservation,
      id: 'obs-1',
      walk_completion: 'COMPLETED' as const,
      completion_comment: null,
    }
    const supabase = buildSupabase([obs])

    const result = await getSlotReportViewData(supabase as never, 'slot-1', 'admin-user')

    expect(result!.observations[0].completionComment).toBeNull()
  })

  it('handles mixed observations: one with comment, one without', async () => {
    const observations = [
      {
        ...baseObservation,
        id: 'obs-partial',
        user_id: 'user-a',
        walk_completion: 'PARTIAL' as const,
        completion_comment: 'Stopped at checkpoint 3',
      },
      {
        ...baseObservation,
        id: 'obs-completed',
        user_id: 'user-b',
        walk_completion: 'COMPLETED' as const,
        completion_comment: null,
        profiles: { full_name: 'User B', email: 'b@example.com', avatar_url: null },
      },
    ]
    const supabase = buildSupabase(observations)

    const result = await getSlotReportViewData(supabase as never, 'slot-1', 'admin-user')

    expect(result!.observations).toHaveLength(2)
    const partial = result!.observations.find(o => o.id === 'obs-partial')
    const completed = result!.observations.find(o => o.id === 'obs-completed')
    expect(partial!.completionComment).toBe('Stopped at checkpoint 3')
    expect(completed!.completionComment).toBeNull()
  })

  it('preserves completionComment with special characters', async () => {
    const specialComment = 'Encountered <dangerous> situation & had to 撤退'
    const obs = {
      ...baseObservation,
      id: 'obs-1',
      walk_completion: 'ABORTED' as const,
      completion_comment: specialComment,
    }
    const supabase = buildSupabase([obs])

    const result = await getSlotReportViewData(supabase as never, 'slot-1', 'admin-user')

    expect(result!.observations[0].completionComment).toBe(specialComment)
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
