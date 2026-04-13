/**
 * Tests for completion comment display in GroupViewClient / ObservationDetails.
 *
 * Covers:
 * - Comment displayed when present
 * - Comment hidden when null
 * - Comment hidden when empty string
 * - Multiple observations with mixed comments
 * - Special characters in comment
 * - Admin view (via backHref="/admin/reports") also shows the comment
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/actions/observation-actions', () => ({
  submitObservation: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/actions/incident-actions', () => ({
  reportIncident: vi.fn().mockResolvedValue({ success: true, incidentId: 'inc-1' }),
}))

vi.mock('@/components/report/media-gallery', () => ({
  MediaGallery: () => <div data-testid="media-gallery" />,
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/components/ui/confirmation-dialog', () => ({
  ConfirmationDialog: () => null,
}))

vi.mock('@/components/ui/breadcrumb', () => ({
  Breadcrumb: () => <div data-testid="breadcrumb" />,
}))

vi.mock('@/app/(app)/report/[walkId]/incident-modal', () => ({
  IncidentModal: () => null,
}))

vi.mock('@/lib/utils/format-date', () => ({
  formatDate: vi.fn((d: string) => d),
}))

import { GroupViewClient } from '@/app/(app)/report/[walkId]/group-view-client'

const defaultSlot = {
  id: 'slot-1',
  locationName: 'Forest Trail',
  walkDate: '2026-04-12',
  startTime: '08:00',
  endTime: '10:00',
  roundName: 'Round 1',
}

const baseObservation = {
  id: 'obs-1',
  userId: 'user-a',
  userName: 'Alice',
  walkCompletion: 'COMPLETED' as string | null,
  completionComment: null as string | null,
  outcome: 'NOT_SIGHTED' as string | null,
  notes: null as string | null,
  lat: 1.35,
  lng: 103.82,
  status: 'SUBMITTED',
  submittedAt: '2026-04-12T03:00:00Z',
  sightings: [],
  media: [],
}

function renderGroupView(
  observations: typeof baseObservation[],
  overrides: Partial<Parameters<typeof GroupViewClient>[0]> = {}
) {
  return render(
    <GroupViewClient
      slot={defaultSlot}
      observations={observations}
      members={[{ userId: 'user-a', fullName: 'Alice', email: 'alice@example.com' }]}
      incidents={[]}
      currentUserId="admin-user"
      {...overrides}
    />
  )
}

/**
 * Helper: expand an observation card to reveal ObservationDetails.
 * Cards start collapsed; clicking the header row expands them.
 */
function expandObservation(userName: string) {
  const header = screen.getByText(userName)
  fireEvent.click(header)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('Completion comment display in ObservationDetails', () => {
  it('shows completion comment when present on a PARTIAL observation', () => {
    renderGroupView([
      {
        ...baseObservation,
        walkCompletion: 'PARTIAL',
        completionComment: 'Rain started, had to cut short',
      },
    ])
    expandObservation('Alice')
    expect(screen.getByText('Completion Comment')).toBeInTheDocument()
    expect(screen.getByText('Rain started, had to cut short')).toBeInTheDocument()
  })

  it('shows completion comment when present on an ABORTED observation', () => {
    renderGroupView([
      {
        ...baseObservation,
        walkCompletion: 'ABORTED',
        completionComment: 'Trail blocked by fallen tree',
      },
    ])
    expandObservation('Alice')
    expect(screen.getByText('Completion Comment')).toBeInTheDocument()
    expect(screen.getByText('Trail blocked by fallen tree')).toBeInTheDocument()
  })

  it('does not show completion comment section when comment is null', () => {
    renderGroupView([
      {
        ...baseObservation,
        walkCompletion: 'COMPLETED',
        completionComment: null,
      },
    ])
    expandObservation('Alice')
    expect(screen.queryByText('Completion Comment')).not.toBeInTheDocument()
  })

  it('does not show completion comment section when comment is empty string', () => {
    renderGroupView([
      {
        ...baseObservation,
        walkCompletion: 'PARTIAL',
        completionComment: '',
      },
    ])
    expandObservation('Alice')
    // Empty string is falsy, so the conditional block should not render
    expect(screen.queryByText('Completion Comment')).not.toBeInTheDocument()
  })

  it('handles special characters in completion comment', () => {
    const specialComment = 'Weather: <thunderstorm> & heavy 🌧️ rain'
    renderGroupView([
      {
        ...baseObservation,
        walkCompletion: 'ABORTED',
        completionComment: specialComment,
      },
    ])
    expandObservation('Alice')
    expect(screen.getByText(specialComment)).toBeInTheDocument()
  })

  it('handles long completion comment text', () => {
    const longComment = 'A'.repeat(500)
    renderGroupView([
      {
        ...baseObservation,
        walkCompletion: 'PARTIAL',
        completionComment: longComment,
      },
    ])
    expandObservation('Alice')
    expect(screen.getByText(longComment)).toBeInTheDocument()
  })

  it('shows comment for admin view (via backHref)', () => {
    renderGroupView(
      [
        {
          ...baseObservation,
          walkCompletion: 'PARTIAL',
          completionComment: 'Admin should see this',
        },
      ],
      { backHref: '/admin/reports', backLabel: 'Back to Admin Reports' }
    )
    expandObservation('Alice')
    expect(screen.getByText('Completion Comment')).toBeInTheDocument()
    expect(screen.getByText('Admin should see this')).toBeInTheDocument()
  })

  it('shows comments independently for multiple observations', () => {
    renderGroupView([
      {
        ...baseObservation,
        id: 'obs-1',
        userId: 'user-a',
        userName: 'Alice',
        walkCompletion: 'PARTIAL',
        completionComment: 'Rain',
      },
      {
        ...baseObservation,
        id: 'obs-2',
        userId: 'user-b',
        userName: 'Bob',
        walkCompletion: 'COMPLETED',
        completionComment: null,
      },
    ])

    // Expand Alice — should have comment
    expandObservation('Alice')
    expect(screen.getByText('Rain')).toBeInTheDocument()

    // Expand Bob — should NOT have comment label
    expandObservation('Bob')
    // Only one "Completion Comment" label (for Alice)
    const labels = screen.getAllByText('Completion Comment')
    expect(labels).toHaveLength(1)
  })
})
