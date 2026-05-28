import { render, screen } from '@testing-library/react'
import AdminUserHistoryPage from '@/app/(app)/admin/users/[userId]/history/page'
import { DEFAULT_LATE_CANCEL_HOURS } from '@/lib/constants/settings'

const { mockSupabase, mockNotFound } = vi.hoisted(() => ({
  mockSupabase: { from: vi.fn() },
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
  }),
}))

function setupHistoryPage({
  profile = { id: 'user-1', email: 'june@example.com', full_name: 'June Tan' },
  auditLogs = [],
}: {
  profile?: { id: string; email: string; full_name: string | null } | null
  auditLogs?: unknown[]
} = {}) {
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: profile,
              error: null,
            }),
          }),
        }),
      }
    }

    if (table === 'user_audit_logs') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: auditLogs,
              error: null,
            }),
          }),
        }),
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  })
}

describe('AdminUserHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders an empty history message when no audit logs exist', async () => {
    setupHistoryPage()

    render(await AdminUserHistoryPage({ params: Promise.resolve({ userId: 'user-1' }) }))

    expect(screen.getByText('User History')).toBeInTheDocument()
    expect(screen.getByText('June Tan')).toBeInTheDocument()
    expect(screen.getByText('No history yet')).toBeInTheDocument()
    expect(screen.getByText('No audit history has been recorded for this user.')).toBeInTheDocument()
  })

  it('renders a late cancellation audit entry with reason and walk context', async () => {
    setupHistoryPage({
      auditLogs: [{
        id: 'log-1',
        event_type: 'LATE_WALK_CANCELLATION',
        reason: 'Medical appointment',
        occurred_at: '2026-04-14T12:00:00.000Z',
        metadata: {
          location_name: 'Central Park',
          walk_date: '2026-04-15',
          start_time: '08:00:00',
          late_cancel_hours: DEFAULT_LATE_CANCEL_HOURS,
        },
      }],
    })

    render(await AdminUserHistoryPage({ params: Promise.resolve({ userId: 'user-1' }) }))

    expect(screen.getByText('Late Walk Cancellation')).toBeInTheDocument()
    expect(screen.getByText('Medical appointment')).toBeInTheDocument()
    expect(screen.getByText('Central Park')).toBeInTheDocument()
    expect(screen.getByText(`${DEFAULT_LATE_CANCEL_HOURS} hours`)).toBeInTheDocument()
  })

  it('calls notFound when the profile does not exist', async () => {
    setupHistoryPage({ profile: null })

    await expect(
      AdminUserHistoryPage({ params: Promise.resolve({ userId: 'missing-user' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })
})
