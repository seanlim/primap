import { render, screen } from '@testing-library/react'

const { mockSupabase, mockLanding } = vi.hoisted(() => {
  const mockSupabase = { from: vi.fn() }
  const mockLanding = vi.fn()
  return { mockSupabase, mockLanding }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('@/lib/admin-volunteer-analytics', () => ({
  getAdminVolunteerAnalyticsLanding: (...args: unknown[]) => mockLanding(...args),
}))

vi.mock('@/components/map/map-view', () => ({
  MapView: ({ markers }: { markers?: Array<{ label?: string }> }) => (
    <div data-testid="map-view">Markers: {markers?.length ?? 0}</div>
  ),
}))

import AdminDashboard from '../../../app/(app)/admin/page'

function makeAwaitableChain(resolvedValue: unknown) {
  const self: Record<string, unknown> = {}
  const fluent = vi.fn(() => self)
  self.select = fluent
  self.eq = fluent
  self.then = vi.fn((resolve: (value: unknown) => void) => {
    Promise.resolve().then(() => resolve(resolvedValue))
  })
  return self
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dashboard donut analytics without the old standalone analytics card', async () => {
    const results = [
      { count: 12, error: null },
      { count: 2, error: null },
      { count: 1, error: null },
      { count: 8, error: null },
      { count: 15, error: null },
      { count: 0, error: null },
    ]

    let index = 0
    mockSupabase.from.mockImplementation(() => makeAwaitableChain(results[index++]))
    mockLanding.mockResolvedValue({
      overall: {
        reportCompletionRate: 0.5,
        completionRateSubmittedReports: 6,
        completionRateExpectedReports: 12,
        capacityFillRate: 0.75,
        walkSignUps: 9,
        totalVolunteerCapacity: 12,
        totalWalks: 8,
        completedWalks: 5,
        upcomingWalks: 3,
        participatingVolunteers: 7,
        walkCancellations: 2,
      },
      reportMapPoints: [],
    })

    render(await AdminDashboard())

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Completion Rate')).toBeInTheDocument()
    expect(screen.getByText('Sign-up Rate')).toBeInTheDocument()
    expect(screen.getByText('completed reports')).toBeInTheDocument()
    expect(screen.getByText('total reports required')).toBeInTheDocument()
    expect(screen.getByText('sign-ups')).toBeInTheDocument()
    expect(screen.getByText('total available capacity')).toBeInTheDocument()
    expect(screen.getByText('Overall Sighting Map')).toBeInTheDocument()
    expect(screen.getByTestId('map-view')).toHaveTextContent('Markers: 0')
    expect(screen.getByRole('link', { name: /Users/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Rounds/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Volunteer Analytics$/i })).not.toBeInTheDocument()
  }, 20000)
})
