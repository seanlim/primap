import { render, screen } from '@testing-library/react'

// ── Hoisted mocks ──────────────────────────────────────────────────────

const {
  mockSupabase,
  mockRedirect,
  mockNotFound,
  mockAdminGetObservation,
  mockAdminEditFormClient,
} = vi.hoisted(() => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  }
  // redirect and notFound must throw to stop execution (matching Next.js behavior)
  const mockRedirect = vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  })
  const mockNotFound = vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  })
  const mockAdminGetObservation = vi.fn()
  const mockAdminEditFormClient = vi.fn((_props: unknown) => (
    <div data-testid="admin-edit-form-client" />
  ))
  return {
    mockSupabase,
    mockRedirect,
    mockNotFound,
    mockAdminGetObservation,
    mockAdminEditFormClient,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase),
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
  notFound: () => mockNotFound(),
}))

vi.mock('@/lib/actions/admin-observation-actions', () => ({
  adminGetObservation: (...args: unknown[]) => mockAdminGetObservation(...args),
}))

vi.mock(
  '@/app/(app)/admin/reports/[walkId]/[observationId]/edit/admin-edit-form-client',
  () => ({
    AdminEditFormClient: (props: unknown) => mockAdminEditFormClient(props),
  })
)

import AdminEditObservationPage from '@/app/(app)/admin/reports/[walkId]/[observationId]/edit/page'

// ── Helpers ────────────────────────────────────────────────────────────

function makeAwaitableChain(resolvedValue: unknown) {
  const self: Record<string, unknown> = {}
  const fluent = vi.fn(() => self)
  self.select = fluent
  self.eq = fluent
  self.limit = fluent
  self.single = vi.fn().mockResolvedValue(resolvedValue)
  self.then = vi.fn((resolve: (value: unknown) => void) => {
    Promise.resolve().then(() => resolve(resolvedValue))
  })
  return self
}

const fakeObservation = {
  id: 'obs-1',
  members: [{ userId: 'user-1', userName: 'Alice' }],
  slotId: 'slot-1',
  walkCompletion: 'COMPLETED',
  outcome: 'SIGHTED',
  notes: 'Test notes',
  lat: null,
  lng: null,
  status: 'SUBMITTED',
  sightings: [
    {
      id: 'sight-1',
      species: 'RBL',
      speciesOther: null,
      count: '3',
      observedAt: '2026-04-01T08:30',
      lat: 1.36,
      lng: 103.83,
      notes: 'Near trail',
      media: [],
    },
  ],
  media: [],
}

const fakeWalk = {
  id: 'slot-1',
  location_name: 'MacRitchie Trail',
  walk_date: '2026-04-01',
  start_time: '08:00:00',
  end_time: '10:00:00',
  survey_rounds: { name: 'Round 1' },
}

const defaultParams = Promise.resolve({
  walkId: 'slot-1',
  observationId: 'obs-1',
})

// ── Tests ──────────────────────────────────────────────────────────────

describe('AdminEditObservationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
    })
  })

  it('redirects to /login when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    })
    // from() still needs to return something even though redirect throws first
    mockSupabase.from.mockImplementation(() =>
      makeAwaitableChain({ data: null, error: null })
    )

    await expect(
      AdminEditObservationPage({ params: defaultParams })
    ).rejects.toThrow('NEXT_REDIRECT:/login')

    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('calls notFound when walk slot does not exist', async () => {
    let chainIndex = 0
    mockSupabase.from.mockImplementation(() => {
      chainIndex++
      if (chainIndex === 1) {
        // walk_slots query
        return makeAwaitableChain({ data: null, error: { message: 'not found' } })
      }
      // app_settings query
      return makeAwaitableChain({
        data: { max_media_per_report: 10 },
        error: null,
      })
    })

    await expect(
      AdminEditObservationPage({ params: defaultParams })
    ).rejects.toThrow('NEXT_NOT_FOUND')

    expect(mockNotFound).toHaveBeenCalled()
  })

  it('calls notFound when observation does not exist', async () => {
    mockSupabase.from.mockImplementation(() =>
      makeAwaitableChain({ data: fakeWalk, error: null })
    )
    mockAdminGetObservation.mockResolvedValue(null)

    await expect(
      AdminEditObservationPage({ params: defaultParams })
    ).rejects.toThrow('NEXT_NOT_FOUND')

    expect(mockNotFound).toHaveBeenCalled()
  })

  it('calls notFound when observation belongs to a different walk', async () => {
    mockSupabase.from.mockImplementation(() =>
      makeAwaitableChain({ data: fakeWalk, error: null })
    )
    mockAdminGetObservation.mockResolvedValue({
      ...fakeObservation,
      slotId: 'different-slot',
    })

    await expect(
      AdminEditObservationPage({ params: defaultParams })
    ).rejects.toThrow('NEXT_NOT_FOUND')

    expect(mockNotFound).toHaveBeenCalled()
  })

  it('renders the AdminEditFormClient with correct props', async () => {
    let chainIndex = 0
    mockSupabase.from.mockImplementation(() => {
      chainIndex++
      if (chainIndex === 1) {
        return makeAwaitableChain({ data: fakeWalk, error: null })
      }
      return makeAwaitableChain({
        data: { max_media_per_report: 5 },
        error: null,
      })
    })
    mockAdminGetObservation.mockResolvedValue(fakeObservation)

    render(await AdminEditObservationPage({ params: defaultParams }))

    expect(screen.getByTestId('admin-edit-form-client')).toBeInTheDocument()
    expect(mockAdminEditFormClient).toHaveBeenCalledWith(
      expect.objectContaining({
        slot: {
          id: 'slot-1',
          locationName: 'MacRitchie Trail',
          walkDate: '2026-04-01',
          startTime: '08:00:00',
          endTime: '10:00:00',
          roundName: 'Round 1',
        },
        observation: fakeObservation,
        maxMediaPerReport: 5,
      })
    )
  })

  it('falls back to default max media when settings query returns null', async () => {
    let chainIndex = 0
    mockSupabase.from.mockImplementation(() => {
      chainIndex++
      if (chainIndex === 1) {
        return makeAwaitableChain({ data: fakeWalk, error: null })
      }
      return makeAwaitableChain({ data: null, error: null })
    })
    mockAdminGetObservation.mockResolvedValue(fakeObservation)

    render(await AdminEditObservationPage({ params: defaultParams }))

    expect(mockAdminEditFormClient).toHaveBeenCalledWith(
      expect.objectContaining({
        maxMediaPerReport: 10,
      })
    )
  })

  it('passes the observationId from params to adminGetObservation', async () => {
    mockSupabase.from.mockImplementation(() =>
      makeAwaitableChain({ data: fakeWalk, error: null })
    )
    mockAdminGetObservation.mockResolvedValue(fakeObservation)

    render(await AdminEditObservationPage({ params: defaultParams }))

    expect(mockAdminGetObservation).toHaveBeenCalledWith('obs-1')
  })
})
