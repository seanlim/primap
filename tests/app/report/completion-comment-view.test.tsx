/**
 * Tests for completion comment display in GroupViewClient / ObservationDetails.
 *
 * Covers:
 * - Comment displayed when present
 * - Comment hidden when null
 * - Comment hidden when empty string
 * - Special characters in comment
 * - Long comment text
 * - Admin view (via backHref="/admin/reports") also shows the comment
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

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

const defaultMembers = [{ userId: 'user-a', fullName: 'Alice', email: 'alice@example.com' }]

function renderGroupView(
  observation: typeof baseObservation,
  overrides: Partial<Parameters<typeof GroupViewClient>[0]> = {}
) {
  return render(
    <GroupViewClient
      slot={defaultSlot}
      observations={observation}
      members={defaultMembers}
      incidents={[]}
      currentUserId="admin-user"
      {...overrides}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('Completion comment display in ObservationDetails', () => {
  it('shows completion comment when present on a PARTIAL observation', () => {
    renderGroupView({
      ...baseObservation,
      walkCompletion: 'PARTIAL',
      completionComment: 'Rain started, had to cut short',
    })
    expect(screen.getByText('Completion Comment')).toBeInTheDocument()
    expect(screen.getByText('Rain started, had to cut short')).toBeInTheDocument()
  })

  it('shows completion comment when present on an ABORTED observation', () => {
    renderGroupView({
      ...baseObservation,
      walkCompletion: 'ABORTED',
      completionComment: 'Trail blocked by fallen tree',
    })
    expect(screen.getByText('Completion Comment')).toBeInTheDocument()
    expect(screen.getByText('Trail blocked by fallen tree')).toBeInTheDocument()
  })

  it('does not show completion comment section when comment is null', () => {
    renderGroupView({
      ...baseObservation,
      walkCompletion: 'COMPLETED',
      completionComment: null,
    })
    expect(screen.queryByText('Completion Comment')).not.toBeInTheDocument()
  })

  it('does not show completion comment section when comment is empty string', () => {
    renderGroupView({
      ...baseObservation,
      walkCompletion: 'PARTIAL',
      completionComment: '',
    })
    // Empty string is falsy, so the conditional block should not render
    expect(screen.queryByText('Completion Comment')).not.toBeInTheDocument()
  })

  it('handles special characters in completion comment', () => {
    const specialComment = 'Weather: <thunderstorm> & heavy 🌧️ rain'
    renderGroupView({
      ...baseObservation,
      walkCompletion: 'ABORTED',
      completionComment: specialComment,
    })
    expect(screen.getByText(specialComment)).toBeInTheDocument()
  })

  it('handles long completion comment text', () => {
    const longComment = 'A'.repeat(500)
    renderGroupView({
      ...baseObservation,
      walkCompletion: 'PARTIAL',
      completionComment: longComment,
    })
    expect(screen.getByText(longComment)).toBeInTheDocument()
  })

  it('shows comment for admin view (via backHref)', () => {
    renderGroupView(
      {
        ...baseObservation,
        walkCompletion: 'PARTIAL',
        completionComment: 'Admin should see this',
      },
      { backHref: '/admin/reports', backLabel: 'Back to Admin Reports' }
    )
    expect(screen.getByText('Completion Comment')).toBeInTheDocument()
    expect(screen.getByText('Admin should see this')).toBeInTheDocument()
  })
})
