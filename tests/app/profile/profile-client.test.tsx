import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ProfileClient } from '@/app/(app)/profile/profile-client'
import { updateProfile } from '@/lib/actions/profile-actions'

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
          phoneNumber: '+6591234567',
          phoneVerifiedAt: null,
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
          phoneNumber: '+6591234567',
          phoneVerifiedAt: null,
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

  it('prompts for a missing phone number and saves contact details together', async () => {
    vi.mocked(updateProfile).mockResolvedValue({ success: true })

    render(
      <ProfileClient
        profile={{
          id: 'user-1',
          email: 'volunteer@example.com',
          fullName: 'Volunteer One',
          avatarUrl: null,
          phoneNumber: null,
          phoneVerifiedAt: null,
          role: 'VOLUNTEER',
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00.000Z',
        }}
        stats={{ walksJoined: 0, reportsSubmitted: 0, draftsPending: 0, requiredWalks: 4 }}
        reportMapPoints={[]}
        walkHistory={[]}
      />
    )

    expect(screen.getByText('Add a phone number to join walks')).toBeInTheDocument()
    expect(screen.getByText('No phone number yet')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add phone number' }))
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Volunteer One' } })
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '9123 4567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith({
        fullName: 'Volunteer One',
        phoneNumber: '9123 4567',
      })
    })
  })

  it('shows the server validation error for an invalid phone number', async () => {
    vi.mocked(updateProfile).mockResolvedValue({
      error: 'Enter a valid phone number, e.g. +65 9123 4567.',
      fieldErrors: { phoneNumber: 'Enter a valid phone number, e.g. +65 9123 4567.' },
    })

    render(
      <ProfileClient
        profile={{
          id: 'user-1',
          email: 'volunteer@example.com',
          fullName: 'Volunteer One',
          avatarUrl: null,
          phoneNumber: null,
          phoneVerifiedAt: null,
          role: 'VOLUNTEER',
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00.000Z',
        }}
        stats={{ walksJoined: 0, reportsSubmitted: 0, draftsPending: 0, requiredWalks: 4 }}
        reportMapPoints={[]}
        walkHistory={[]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add phone number' }))
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '12345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Enter a valid phone number, e.g. +65 9123 4567.')).toBeInTheDocument()
    expect(screen.getByLabelText('Phone number')).toHaveAttribute('aria-invalid', 'true')
  })
})
