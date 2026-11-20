import { render, screen } from '@testing-library/react'

const { mockSupabase, mockProfileClient, mockRedirect } = vi.hoisted(() => {
  const mockSupabase = {
    rpc: vi.fn(),
  }
  const mockProfileClient = vi.fn<(props: unknown) => import('react').ReactElement>(() => <div data-testid="profile-client" />)
  // Next's redirect() throws to unwind the render; mirror that so the page stops.
  const mockRedirect = vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  })
  return { mockSupabase, mockProfileClient, mockRedirect }
})

vi.mock('@/lib/supabase/session', () => ({
  requireSession: vi.fn(async () => ({ supabase: mockSupabase, userId: 'user-1' })),
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

vi.mock('@/app/(app)/profile/profile-client', () => ({
  ProfileClient: (props: unknown) => mockProfileClient(props),
}))

import ProfilePage from '@/app/(app)/profile/page'

const profile = {
  id: 'user-1',
  email: 'volunteer@example.com',
  full_name: 'Volunteer One',
  avatar_url: null,
  phone_number: '+6591234567',
  phone_verified_at: null,
  birth_month: null,
  role: 'VOLUNTEER',
  status: 'ACTIVE',
  created_at: '2026-01-01T00:00:00.000Z',
}

const walkSlot = {
  id: 'slot-1',
  location_name: 'Bukit Timah',
  walk_date: '2026-04-05',
  start_time: '07:00:00',
  end_time: '09:00:00',
  survey_rounds: { name: 'Round 2' },
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the whole page from a single RPC payload', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: {
        profile,
        submitted_observations: [
          {
            id: 'obs-1',
            slot_id: 'slot-1',
            status: 'SUBMITTED',
            outcome: 'SIGHTED',
            lat: 1.35,
            lng: 103.78,
            walk_slots: walkSlot,
          },
        ],
        walk_history: [
          {
            membership_id: 'membership-1',
            slot_id: 'slot-1',
            history_type: 'active',
            walk_slots: walkSlot,
          },
        ],
        history_observations: [
          { id: 'obs-1', slot_id: 'slot-1', status: 'SUBMITTED', outcome: 'SIGHTED' },
        ],
        attendance: [{ slot_id: 'slot-1', status: 'PRESENT' }],
        sightings: [
          { observation_id: 'obs-1', lat: 1.35, lng: 103.78, species: 'RBL', species_other: null },
        ],
        settings: { required_walks_per_round: 4 },
        stats: { drafts_pending: 1, reports_submitted: 2, walks_attended: 3 },
      },
      error: null,
    })

    render(await ProfilePage())

    expect(screen.getByTestId('profile-client')).toBeInTheDocument()
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_profile_page')
    expect(mockProfileClient).toHaveBeenCalledWith(
      expect.objectContaining({
        stats: {
          walksJoined: 3,
          walksAttended: 3,
          draftsPending: 1,
          reportsSubmitted: 2,
          requiredWalks: 4,
        },
        walkHistory: [
          expect.objectContaining({
            membershipId: 'membership-1',
            slotId: 'slot-1',
            roundName: 'Round 2',
            reportStatus: 'SUBMITTED',
            attendance: 'PRESENT',
            sightingCount: 1,
          }),
        ],
        reportMapPoints: [
          expect.objectContaining({ lat: 1.35, lng: 103.78, outcome: 'SIGHTED' }),
        ],
      })
    )
  })

  it('redirects to login when the payload cannot be loaded', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    await expect(ProfilePage()).rejects.toThrow('NEXT_REDIRECT:/login?error=profile_fetch_failed')

    expect(mockRedirect).toHaveBeenCalledWith('/login?error=profile_fetch_failed')
  })

  it('redirects to login when the profile row is missing', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: {
        profile: null,
        submitted_observations: [],
        walk_history: [],
        history_observations: [],
        attendance: [],
        sightings: [],
        settings: null,
        stats: { drafts_pending: 0, reports_submitted: 0, walks_attended: 0 },
      },
      error: null,
    })

    await expect(ProfilePage()).rejects.toThrow('NEXT_REDIRECT:/login')

    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})
