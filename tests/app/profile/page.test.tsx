import { render, screen } from '@testing-library/react'

const { mockSupabase, mockProfileClient, mockRedirect } = vi.hoisted(() => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  }
  const mockProfileClient = vi.fn((_props: unknown) => <div data-testid="profile-client" />)
  const mockRedirect = vi.fn()
  return { mockSupabase, mockProfileClient, mockRedirect }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}))

vi.mock('@/app/(app)/profile/profile-client', () => ({
  ProfileClient: (props: unknown) => mockProfileClient(props),
}))

import ProfilePage from '@/app/(app)/profile/page'

function createQuery(result: { data?: unknown; count?: number | null; error?: { message: string } | null }) {
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    in: vi.fn(() => query),
    single: vi.fn().mockResolvedValue({
      data: result.data ?? null,
      error: result.error ?? null,
      count: result.count ?? null,
    }),
    then: vi.fn((resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve({
        data: result.data ?? null,
        error: result.error ?? null,
        count: result.count ?? null,
      }))
    ),
  }

  return query
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-11T12:00:00+08:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('scopes progress stats to the current round while leaving history separate', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    const tableResults: Record<string, Array<{ data?: unknown; count?: number | null }>> = {
      profiles: [
        {
          data: {
            id: 'user-1',
            email: 'volunteer@example.com',
            full_name: 'Volunteer One',
            avatar_url: null,
            role: 'VOLUNTEER',
            status: 'ACTIVE',
            created_at: '2026-01-01T00:00:00.000Z',
          },
        },
      ],
      slot_memberships: [
        { data: [] },
        { count: 2 },
      ],
      observations: [
        { data: [] },
        { count: 1 },
        { count: 1 },
      ],
      app_settings: [
        { data: { required_walks_per_round: 4 } },
      ],
      survey_rounds: [
        {
          data: [
            { id: 'round-1', name: 'Round 1', start_date: '2026-03-01', end_date: '2026-03-31' },
            { id: 'round-2', name: 'Round 2', start_date: '2026-04-01', end_date: '2026-04-30' },
          ],
        },
      ],
      walk_slots: [
        {
          data: [
            { id: 'slot-current-1' },
            { id: 'slot-current-2' },
          ],
        },
      ],
    }

    const callCounts = new Map<string, number>()

    mockSupabase.from.mockImplementation((table: string) => ({
      select: () => {
        const index = callCounts.get(table) ?? 0
        callCounts.set(table, index + 1)
        const result = tableResults[table]?.[index]
        if (!result) throw new Error(`Unexpected query for table ${table} at call ${index + 1}`)
        return createQuery(result)
      },
    }))

    render(await ProfilePage())

    expect(screen.getByTestId('profile-client')).toBeInTheDocument()
    expect(mockProfileClient).toHaveBeenCalledWith(
      expect.objectContaining({
        stats: expect.objectContaining({
          walksJoined: 2,
          draftsPending: 1,
          reportsSubmitted: 1,
          requiredWalks: 4,
        }),
      })
    )
  })
})
