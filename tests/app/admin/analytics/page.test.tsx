import { render, screen, within } from '@testing-library/react'

const { mockSupabase } = vi.hoisted(() => {
  const mockSupabase = { from: vi.fn() }
  return { mockSupabase }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

import AdminAnalyticsPage from '../../../../app/(app)/admin/analytics/page'

function makeAwaitableChain(resolvedValue: unknown) {
  const self: Record<string, unknown> = {}

  const fluent = vi.fn(() => self)
  self.select = fluent
  self.eq = fluent
  self.order = fluent
  self.limit = fluent
  self.in = fluent
  self.then = vi.fn((resolve: (value: unknown) => void) => {
    Promise.resolve().then(() => resolve(resolvedValue))
  })

  return self
}

function queueFromResults(results: unknown[]) {
  let index = 0
  mockSupabase.from.mockImplementation(() => makeAwaitableChain(results[index++]))
}

describe('AdminAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-20T12:00:00+08:00'))
  })

  function expectCardValue(label: string, value: string) {
    const labelNode = screen.getByText(label)
    const card = labelNode.closest('div')?.parentElement
    expect(card).not.toBeNull()
    expect(within(card as HTMLElement).getByText(value)).toBeInTheDocument()
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('prefers the open round when one is available', async () => {
    queueFromResults([
      { data: [{ id: 'round-open', name: 'Open Round', start_date: '2026-03-01', end_date: '2026-03-31', status: 'OPEN' }], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { count: 5, error: null },
      { count: 10, error: null },
      { count: 2, error: null },
      { count: 7, error: null },
    ])

    render(await AdminAnalyticsPage())

    expect(screen.getByText('Volunteer Analytics')).toBeInTheDocument()
    expect(screen.getByText(/Open Round \(OPEN\)/)).toBeInTheDocument()
  })

  it('falls back to the latest round when no round is open', async () => {
    queueFromResults([
      { data: [], error: null },
      { data: [{ id: 'round-latest', name: 'Latest Round', start_date: '2026-02-01', end_date: '2026-02-28', status: 'CLOSED' }], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { count: 5, error: null },
      { count: 10, error: null },
      { count: 2, error: null },
      { count: 7, error: null },
    ])

    render(await AdminAnalyticsPage())

    expect(screen.getByText(/Latest Round \(CLOSED\)/)).toBeInTheDocument()
  })

  it('shows an empty state when no rounds exist', async () => {
    queueFromResults([
      { data: [], error: null },
      { data: [], error: null },
    ])

    render(await AdminAnalyticsPage())

    expect(screen.getByText('No survey rounds yet')).toBeInTheDocument()
    expect(screen.getByText(/Create a survey round to start tracking volunteer analytics/)).toBeInTheDocument()
  })

  it('renders aggregated KPI values from Supabase data', async () => {
    queueFromResults([
      { data: [{ id: 'round-open', name: 'Open Round', start_date: '2026-03-01', end_date: '2026-03-31', status: 'OPEN' }], error: null },
      {
        data: [
          { id: 'slot-ended-1', walk_date: '2026-03-10', end_time: '10:00:00', max_volunteers: 3 },
          { id: 'slot-ended-2', walk_date: '2026-03-12', end_time: '10:00:00', max_volunteers: 2 },
          { id: 'slot-upcoming', walk_date: '2026-03-25', end_time: '10:00:00', max_volunteers: 5 },
        ],
        error: null,
      },
      {
        data: [
          { slot_id: 'slot-ended-1', user_id: 'user-1', status: 'ACTIVE' },
          { slot_id: 'slot-ended-1', user_id: 'user-2', status: 'ACTIVE' },
          { slot_id: 'slot-ended-2', user_id: 'user-1', status: 'ACTIVE' },
          { slot_id: 'slot-upcoming', user_id: 'user-3', status: 'ACTIVE' },
          { slot_id: 'slot-upcoming', user_id: 'user-4', status: 'CANCELLED' },
        ],
        error: null,
      },
      {
        data: [
          { slot_id: 'slot-ended-1', status: 'SUBMITTED' },
          { slot_id: 'slot-upcoming', status: 'SUBMITTED' },
        ],
        error: null,
      },
      { count: 11, error: null },
      { count: 28, error: null },
      { count: 5, error: null },
      { count: 16, error: null },
    ])

    render(await AdminAnalyticsPage())

    expectCardValue('Participating Volunteers', '3')
    expectCardValue('Walk Sign-ups', '4')
    expectCardValue('Walk Cancellations', '1')
    expectCardValue('Submitted Reports', '2')
    expectCardValue('Report Completion Rate', '33%')
    expectCardValue('Average Volunteers per Walk', '1.3')
    expectCardValue('Capacity Fill Rate', '40%')
    expectCardValue('Active Registered Volunteers', '11')
    expectCardValue('Total Volunteer Sign-ups', '28')
    expectCardValue('Total Volunteer Cancellations', '5')
    expectCardValue('Total Submitted Reports', '16')
    expect(screen.getByText('All-Time Volunteer Totals')).toBeInTheDocument()
  })
})
