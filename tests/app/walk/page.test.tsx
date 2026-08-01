import { render, screen } from '@testing-library/react'

const { mockSupabase, mockRedirect } = vi.hoisted(() => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  }
  const mockRedirect = vi.fn()
  return { mockSupabase, mockRedirect }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation')
  return {
    ...actual,
    redirect: (...args: unknown[]) => mockRedirect(...args),
  }
})

vi.mock('@/app/(app)/walk/walk-filters-client', () => ({
  WalkFilters: () => <div data-testid="walk-filters" />,
}))

vi.mock('@/app/(app)/walk/invitation-response-actions', () => ({
  InvitationResponseActions: ({ invitationId }: { invitationId: string }) => (
    <div data-testid={`invitation-actions-${invitationId}`} />
  ),
}))

import WalkPage from '@/app/(app)/walk/page'

function createQuery(result: { data?: unknown; count?: number | null; error?: { message: string } | null }) {
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    ilike: vi.fn(() => query),
    order: vi.fn(() => query),
    select: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve({
        data: result.data ?? null,
        count: result.count ?? null,
        error: result.error ?? null,
      }))
    ),
  }

  return query
}

describe('WalkPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-11T12:00:00+08:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('groups available and joined walks by round', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    const tableResults: Record<string, Array<{ data?: unknown; count?: number | null }>> = {
      survey_rounds: [
        {
          data: [
            { id: 'round-1', name: 'Round Alpha', status: 'OPEN', start_date: '2026-04-01', end_date: '2026-04-30' },
            { id: 'round-2', name: 'Round Beta', status: 'OPEN', start_date: '2026-05-01', end_date: '2026-05-31' },
          ],
        },
      ],
      walk_slots: [
        {
          data: [
            {
              id: 'slot-1',
              round_id: 'round-1',
              location_name: 'Hill Park',
              walk_date: '2026-04-12',
              start_time: '08:00:00',
              end_time: '10:00:00',
              max_volunteers: 3,
              slot_memberships: [{ user_id: 'user-1', status: 'ACTIVE' }],
            },
            {
              id: 'slot-past',
              round_id: 'round-1',
              location_name: 'Old Trail',
              walk_date: '2026-04-08',
              start_time: '08:00:00',
              end_time: '10:00:00',
              max_volunteers: 3,
              slot_memberships: [],
            },
            {
              id: 'slot-2',
              round_id: 'round-1',
              location_name: 'River Bend',
              walk_date: '2026-04-13',
              start_time: '08:00:00',
              end_time: '10:00:00',
              max_volunteers: 3,
              slot_memberships: [],
            },
            {
              id: 'slot-3',
              round_id: 'round-2',
              location_name: 'Coast Trail',
              walk_date: '2026-05-03',
              start_time: '08:00:00',
              end_time: '10:00:00',
              max_volunteers: 4,
              slot_memberships: [],
            },
          ],
          count: 4,
        },
      ],
      slot_memberships: [
        {
          data: [{ slot_id: 'slot-1' }],
        },
      ],
      slot_invitations: [
        {
          data: [],
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

    render(await WalkPage({ searchParams: Promise.resolve({}) }))

    expect(screen.getByText('My Walks')).toBeInTheDocument()
    expect(screen.getByText('Round Alpha')).toBeInTheDocument()
    expect(screen.getByText('Round Beta')).toBeInTheDocument()
    expect(screen.getByText('Current Round')).toBeInTheDocument()
    expect(screen.getAllByText('Joined').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0)
    expect(screen.getByText('Coast Trail')).toBeInTheDocument()
  })

  it('shows round available counts for the current page slice', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    const roundOneSlots = Array.from({ length: 12 }, (_, index) => ({
      id: `slot-${index + 1}`,
      round_id: 'round-1',
      location_name: `Round One Walk ${index + 1}`,
      walk_date: `2026-04-${String(12 + index).padStart(2, '0')}`,
      start_time: '08:00:00',
      end_time: '10:00:00',
      max_volunteers: 3,
      slot_memberships: [],
    }))

    const tableResults: Record<string, Array<{ data?: unknown; count?: number | null }>> = {
      survey_rounds: [
        {
          data: [
            { id: 'round-1', name: 'Round Alpha', status: 'OPEN', start_date: '2026-04-01', end_date: '2026-04-30' },
          ],
        },
      ],
      walk_slots: [
        {
          data: roundOneSlots,
          count: 12,
        },
      ],
      slot_memberships: [
        {
          data: [],
        },
      ],
      slot_invitations: [
        {
          data: [],
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

    render(await WalkPage({ searchParams: Promise.resolve({ page: '2' }) }))

    expect(screen.getByText('Round Alpha')).toBeInTheDocument()
    expect(screen.getByText('Round One Walk 11')).toBeInTheDocument()
    expect(screen.getByText('Round One Walk 12')).toBeInTheDocument()
    expect(screen.queryByText('Round One Walk 1')).not.toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
  })

  it('shows pending invitations and reserves full capacity', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    const tableResults: Record<string, Array<{ data?: unknown; count?: number | null }>> = {
      survey_rounds: [
        {
          data: [
            { id: 'round-1', name: 'Round Alpha', status: 'OPEN', start_date: '2026-04-01', end_date: '2026-04-30' },
          ],
        },
      ],
      walk_slots: [
        {
          data: [
            {
              id: 'slot-1',
              round_id: 'round-1',
              location_name: 'Hill Park',
              walk_date: '2026-04-12',
              start_time: '08:00:00',
              end_time: '10:00:00',
              max_volunteers: 2,
              slot_memberships: [{ user_id: 'user-2', status: 'ACTIVE' }],
              slot_invitations: [{ id: 'invite-2', invited_user_id: 'user-3', status: 'PENDING' }],
            },
          ],
          count: 1,
        },
      ],
      slot_memberships: [
        {
          data: [],
        },
      ],
      slot_invitations: [
        {
          data: [{
            id: 'invite-1',
            created_at: '2026-04-11T08:00:00.000Z',
            invited_by: 'user-2',
            inviter: { full_name: 'Alex', email: 'alex@example.com' },
            walk_slots: {
              id: 'slot-invite',
              location_name: 'Canopy Trail',
              walk_date: '2026-04-13',
              start_time: '08:00:00',
              end_time: '10:00:00',
              survey_rounds: {
                id: 'round-1',
                name: 'Round Alpha',
                status: 'OPEN',
                start_date: '2026-04-01',
                end_date: '2026-04-30',
              },
            },
          }],
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

    render(await WalkPage({ searchParams: Promise.resolve({ availability: 'full' }) }))

    expect(screen.getByText('Invitations')).toBeInTheDocument()
    expect(screen.getByText('Canopy Trail')).toBeInTheDocument()
    expect(screen.getByText('Invited by Alex')).toBeInTheDocument()
    expect(screen.getByTestId('invitation-actions-invite-1')).toBeInTheDocument()
    expect(screen.getByText('Hill Park')).toBeInTheDocument()
    expect(screen.getByText('Full')).toBeInTheDocument()
    expect(screen.getByText('1 spot reserved by invitation')).toBeInTheDocument()
  })
})
