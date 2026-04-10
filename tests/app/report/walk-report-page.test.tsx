import { render, screen } from '@testing-library/react'

const { mockSupabase, mockRedirect, mockNotFound, mockGroupViewClient, mockGetSlotReportViewData } = vi.hoisted(() => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
  }
  const mockRedirect = vi.fn()
  const mockNotFound = vi.fn()
  const mockGroupViewClient = vi.fn(() => <div data-testid="group-view-client" />)
  const mockGetSlotReportViewData = vi.fn()
  return { mockSupabase, mockRedirect, mockNotFound, mockGroupViewClient, mockGetSlotReportViewData }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
  notFound: (...args: unknown[]) => mockNotFound(...args),
}))

vi.mock('@/app/(app)/report/[walkId]/group-view-client', () => ({
  GroupViewClient: (props: unknown) => mockGroupViewClient(props),
}))

vi.mock('@/lib/report-slot-data', () => ({
  getSlotReportViewData: (...args: unknown[]) => mockGetSlotReportViewData(...args),
}))

import WalkReportPage from '@/app/(app)/report/[walkId]/page'

describe('WalkReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
  })

  it('allows users to open submitted report history even without an active membership', async () => {
    mockGetSlotReportViewData.mockResolvedValue({
      slot: {
        id: 'slot-1',
        locationName: 'Historic Walk',
        walkDate: '2026-04-01',
        startTime: '08:00:00',
        endTime: '10:00:00',
        roundName: 'Round 1',
      },
      observations: [],
      members: [],
      incidents: [],
      isParticipant: false,
      hasSubmittedOwnObservation: true,
    })

    render(await WalkReportPage({ params: Promise.resolve({ walkId: 'slot-1' }) }))

    expect(screen.getByTestId('group-view-client')).toBeInTheDocument()
    expect(mockRedirect).not.toHaveBeenCalledWith('/report')
  })

  it('redirects back to the reports list when the user has no access to the walk report', async () => {
    mockGetSlotReportViewData.mockResolvedValue({
      slot: {
        id: 'slot-1',
        locationName: 'Historic Walk',
        walkDate: '2026-04-01',
        startTime: '08:00:00',
        endTime: '10:00:00',
        roundName: 'Round 1',
      },
      observations: [],
      members: [],
      incidents: [],
      isParticipant: false,
      hasSubmittedOwnObservation: false,
    })

    await WalkReportPage({ params: Promise.resolve({ walkId: 'slot-1' }) })

    expect(mockRedirect).toHaveBeenCalledWith('/report')
  })
})
