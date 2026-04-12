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

import ReportListPage from '@/app/(app)/report/page'

function createQuery(result: { data?: unknown; count?: number | null; error?: { message: string } | null }) {
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
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

describe('ReportListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('organizes report items by workflow state', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    const tableResults: Record<string, Array<{ data?: unknown; count?: number | null }>> = {
      slot_memberships: [
        {
          data: [
            {
              id: 'membership-1',
              status: 'ACTIVE',
              walk_slots: {
                id: 'slot-needs-action',
                location_name: 'Ended Walk',
                walk_date: '2026-04-08',
                start_time: '08:00:00',
                end_time: '10:00:00',
                survey_rounds: { name: 'Round 1' },
              },
            },
            {
              id: 'membership-2',
              status: 'ACTIVE',
              walk_slots: {
                id: 'slot-draft',
                location_name: 'Draft Walk',
                walk_date: '2099-04-09',
                start_time: '08:00:00',
                end_time: '10:00:00',
                survey_rounds: { name: 'Round 1' },
              },
            },
            {
              id: 'membership-3',
              status: 'ACTIVE',
              walk_slots: {
                id: 'slot-upcoming',
                location_name: 'Upcoming Walk',
                walk_date: '2099-04-20',
                start_time: '08:00:00',
                end_time: '10:00:00',
                survey_rounds: { name: 'Round 2' },
              },
            },
          ],
        },
      ],
      observations: [
        {
          data: [
            {
              id: 'submitted-history',
              slot_id: 'slot-history',
              status: 'SUBMITTED',
              walk_slots: {
                id: 'slot-history',
                location_name: 'Past Submitted Walk',
                walk_date: '2026-04-01',
                start_time: '08:00:00',
                end_time: '10:00:00',
                survey_rounds: { name: 'Round 0' },
              },
            },
          ],
        },
        {
          data: [
            { id: 'obs-draft', slot_id: 'slot-draft', status: 'DRAFT' },
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

    render(await ReportListPage())

    expect(screen.getByText('Needs Action (1)')).toBeInTheDocument()
    expect(screen.getByText('Submitted (1)')).toBeInTheDocument()
    expect(screen.getByText('Upcoming Walks (2)')).toBeInTheDocument()
    expect(screen.getByText('Ended Walk')).toBeInTheDocument()
    expect(screen.getByText('Draft Walk')).toBeInTheDocument()
    expect(screen.getByText('Past Submitted Walk')).toBeInTheDocument()
    expect(screen.getByText('Upcoming Walk')).toBeInTheDocument()
  })
})
