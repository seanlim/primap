import { render, screen } from '@testing-library/react'

// ── Hoisted mocks ──────────────────────────────────────────────────────

vi.mock('@/lib/actions/observation-actions', () => ({
  submitObservation: vi.fn(),
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@/components/report/media-gallery', () => ({
  MediaGallery: () => <div data-testid="media-gallery" />,
}))

vi.mock('@/app/(app)/report/[walkId]/incident-modal', () => ({
  IncidentModal: () => <div data-testid="incident-modal" />,
}))

import { GroupViewClient } from '@/app/(app)/report/[walkId]/group-view-client'

// ── Helpers ────────────────────────────────────────────────────────────

const defaultSlot = {
  id: 'slot-1',
  locationName: 'MacRitchie Trail',
  walkDate: '2026-04-01',
  startTime: '08:00:00',
  endTime: '10:00:00',
  roundName: 'Round 1',
}

function makeObservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'obs-1',
    userId: 'user-1',
    userName: 'Alice',
    walkCompletion: 'COMPLETED',
    completionComment: null,
    outcome: 'SIGHTED',
    notes: null,
    lat: null,
    lng: null,
    status: 'SUBMITTED',
    submittedAt: '2026-04-01T10:00:00Z',
    sightings: [
      {
        id: 'sight-1',
        species: 'RBL',
        speciesOther: null,
        count: '3',
        observedAt: null,
        lat: 1.36,
        lng: 103.83,
        notes: null,
        media: [],
      },
    ],
    media: [],
    ...overrides,
  }
}

const defaultMembers = [
  { userId: 'user-1', fullName: 'Alice', email: 'alice@test.com' },
  { userId: 'user-2', fullName: 'Bob', email: 'bob@test.com' },
]

// ── Tests ──────────────────────────────────────────────────────────────

describe('GroupViewClient – admin edit buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('admin view (backHref starts with /admin)', () => {
    it('shows Edit button linking to the admin edit path for the observation', () => {
      const obs = makeObservation({ id: 'obs-1' })

      render(
        <GroupViewClient
          slot={defaultSlot}
          observations={obs}
          members={defaultMembers}
          incidents={[]}
          currentUserId="admin-99"
          backHref="/admin/reports"
          backLabel="Back to Admin Reports"
        />
      )

      const editLink = screen.getByRole('link', { name: /edit/i })
      expect(editLink.getAttribute('href')).toBe('/admin/reports/slot-1/obs-1/edit')
    })

    it('does not show user draft Edit/Submit buttons in admin view', () => {
      const draftObs = makeObservation({
        id: 'obs-draft',
        status: 'DRAFT',
      })

      render(
        <GroupViewClient
          slot={defaultSlot}
          observations={draftObs}
          members={defaultMembers}
          incidents={[]}
          currentUserId="admin-1"
          backHref="/admin/reports"
          backLabel="Back to Admin Reports"
        />
      )

      // Should NOT have the /report/slot-1/edit link (user draft edit)
      const allLinks = screen.getAllByRole('link')
      const userEditLink = allLinks.find(
        (el) => el.getAttribute('href') === '/report/slot-1/edit'
      )
      expect(userEditLink).toBeUndefined()

      // Should NOT have a Submit button
      expect(screen.queryByText('Submit')).not.toBeInTheDocument()
    })

    it('renders admin header (ArrowLeft) instead of Breadcrumb', () => {
      render(
        <GroupViewClient
          slot={defaultSlot}
          observations={null as never}
          members={[]}
          incidents={[]}
          currentUserId="admin-1"
          backHref="/admin/reports"
          backLabel="Back to Admin Reports"
        />
      )

      expect(screen.getByText('Reports')).toBeInTheDocument()
      // The admin link back to /admin/reports
      const backLink = screen.getByRole('link')
      expect(backLink.getAttribute('href')).toBe('/admin/reports')
    })
  })

  describe('volunteer view (backHref does NOT start with /admin)', () => {
    it('does NOT show admin Edit buttons', () => {
      const obs = makeObservation({ id: 'obs-1', status: 'SUBMITTED' })

      render(
        <GroupViewClient
          slot={defaultSlot}
          observations={obs}
          members={defaultMembers}
          incidents={[]}
          currentUserId="user-1"
          backHref="/report"
          backLabel="Back to Reports"
        />
      )

      const allLinks = screen.getAllByRole('link')
      const adminEditLink = allLinks.find((el) =>
        el.getAttribute('href')?.includes('/admin/reports/')
      )
      expect(adminEditLink).toBeUndefined()
    })

    it('shows user draft Edit/Submit buttons for a DRAFT observation', () => {
      const draftObs = makeObservation({
        id: 'obs-draft',
        status: 'DRAFT',
      })

      render(
        <GroupViewClient
          slot={defaultSlot}
          observations={draftObs}
          members={defaultMembers}
          incidents={[]}
          currentUserId="user-1"
          backHref="/report"
          backLabel="Back to Reports"
        />
      )

      // Should have the user edit link
      const editLink = screen.getByRole('link', { name: /edit/i })
      expect(editLink.getAttribute('href')).toBe('/report/slot-1/edit')

      // Should have Submit button
      expect(screen.getByText('Submit')).toBeInTheDocument()
    })

    it('does not show Edit/Submit for a SUBMITTED observation', () => {
      const submittedObs = makeObservation({
        id: 'obs-1',
        status: 'SUBMITTED',
      })

      render(
        <GroupViewClient
          slot={defaultSlot}
          observations={submittedObs}
          members={defaultMembers}
          incidents={[]}
          currentUserId="user-1"
          backHref="/report"
          backLabel="Back to Reports"
        />
      )

      expect(screen.queryByText('Submit')).not.toBeInTheDocument()
      // No edit link to /report/slot-1/edit
      const allLinks = screen.queryAllByRole('link', { name: /edit/i })
      const userEditLink = allLinks.find(
        (el) => el.getAttribute('href') === '/report/slot-1/edit'
      )
      expect(userEditLink).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('renders without crashing when there is no observation', () => {
      render(
        <GroupViewClient
          slot={defaultSlot}
          observations={null as never}
          members={defaultMembers}
          incidents={[]}
          currentUserId="admin-1"
          backHref="/admin/reports"
          backLabel="Back to Admin Reports"
        />
      )

      // Should render the walk header
      expect(screen.getByText('MacRitchie Trail')).toBeInTheDocument()
    })

    it('renders NOT_SIGHTED observation details correctly', () => {
      const notSightedObs = makeObservation({
        id: 'obs-ns',
        outcome: 'NOT_SIGHTED',
        lat: 1.35,
        lng: 103.82,
        sightings: [],
      })

      render(
        <GroupViewClient
          slot={defaultSlot}
          observations={notSightedObs}
          members={defaultMembers}
          incidents={[]}
          currentUserId="admin-99"
          backHref="/admin/reports"
          backLabel="Back to Admin Reports"
        />
      )

      expect(screen.getByText('Not Sighted')).toBeInTheDocument()
    })
  })
})
