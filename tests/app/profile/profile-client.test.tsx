import { render, screen } from '@testing-library/react'
import { ProfileClient } from '@/app/(app)/profile/profile-client'

const mockMapView = vi.fn(({ markers }: { markers?: Array<{ lat: number; lng: number; label?: string }> }) => (
  <div data-testid="map-view">{JSON.stringify(markers ?? [])}</div>
))

vi.mock('@/components/map/map-view', () => ({
  MapView: (props: { markers?: Array<{ lat: number; lng: number; label?: string }> }) => mockMapView(props),
}))

vi.mock('@/lib/actions/profile-actions', () => ({
  updateProfile: vi.fn(),
}))

vi.mock('@/lib/actions/auth-actions', () => ({
  signOut: vi.fn(),
}))

describe('ProfileClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the volunteer sighting map with the user sighting markers', () => {
    render(
      <ProfileClient
        profile={{
          id: 'user-1',
          email: 'volunteer@example.com',
          fullName: 'Volunteer One',
          avatarUrl: null,
          role: 'VOLUNTEER',
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00.000Z',
        }}
        stats={{
          walksJoined: 5,
          reportsSubmitted: 3,
          draftsPending: 1,
          requiredWalks: 4,
        }}
        reportMapPoints={[
          { lat: 1.3521, lng: 103.8198, outcome: 'SIGHTED', label: 'Hill' },
          { lat: 1.301, lng: 103.77, outcome: 'NOT_SIGHTED', label: 'River' },
        ]}
        walkHistory={[]}
      />
    )

    expect(screen.getByText('My Sighting Map')).toBeInTheDocument()
    expect(screen.getByText('2 report coordinates plotted from your submitted reports.')).toBeInTheDocument()
    expect(screen.getByText('Walks Joined')).toBeInTheDocument()
    expect(screen.getAllByText('This round')).toHaveLength(3)
    expect(mockMapView).toHaveBeenCalledWith(
      expect.objectContaining({
        markers: [
          expect.objectContaining({ lat: 1.3521, lng: 103.8198, label: 'Hill', variant: 'sighted' }),
          expect.objectContaining({ lat: 1.301, lng: 103.77, label: 'River', variant: 'not_sighted' }),
        ],
      })
    )
  })

  it('passes through custom OTHER species names for map popups', () => {
    render(
      <ProfileClient
        profile={{
          id: 'user-1',
          email: 'volunteer@example.com',
          fullName: 'Volunteer One',
          avatarUrl: null,
          role: 'VOLUNTEER',
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00.000Z',
        }}
        stats={{
          walksJoined: 5,
          reportsSubmitted: 3,
          draftsPending: 1,
          requiredWalks: 4,
        }}
        reportMapPoints={[
          {
            lat: 1.3521,
            lng: 103.8198,
            outcome: 'SIGHTED',
            species: 'OTHER',
            speciesOther: 'Silvered Langur',
            label: 'Silvered Langur',
          },
        ]}
        walkHistory={[]}
      />
    )

    expect(mockMapView).toHaveBeenCalledWith(
      expect.objectContaining({
        markers: [
          expect.objectContaining({
            species: 'OTHER',
            speciesOther: 'Silvered Langur',
            label: 'Silvered Langur',
          }),
        ],
      })
    )
  })
})
