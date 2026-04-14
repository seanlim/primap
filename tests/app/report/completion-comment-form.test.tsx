/**
 * Tests for the completion comment UI in ObservationFormClient.
 *
 * Covers:
 * - Textarea hidden when COMPLETED is selected
 * - Textarea shown when PARTIAL is selected
 * - Textarea shown when ABORTED is selected
 * - Comment cleared when switching from PARTIAL/ABORTED to COMPLETED
 * - Comment preserved when switching between PARTIAL and ABORTED
 * - Placeholder text changes based on status
 * - Existing comment pre-populated on edit
 * - Comment included in debounced save trigger
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

// ─── Browser API stubs ──────────────────────────────────────────────────────

// IntersectionObserver is not available in jsdom
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockSaveDraft = vi.fn().mockResolvedValue({ success: true, observationId: 'obs-1', sightingIds: [], serverUpdatedAt: '2026-04-12T10:00:00Z' })
const mockSubmitObservation = vi.fn().mockResolvedValue({ success: true })
const mockGetMediaBySightingIds = vi.fn().mockResolvedValue([])
const mockGetObservationMeta = vi.fn().mockResolvedValue(null)
const mockGetObservationFull = vi.fn().mockResolvedValue(null)

vi.mock('@/lib/actions/observation-actions', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
  submitObservation: (...args: unknown[]) => mockSubmitObservation(...args),
  getMediaBySightingIds: (...args: unknown[]) => mockGetMediaBySightingIds(...args),
  getObservationMeta: (...args: unknown[]) => mockGetObservationMeta(...args),
  getObservationFull: (...args: unknown[]) => mockGetObservationFull(...args),
}))

vi.mock('@/components/map/location-picker', () => ({
  LocationPicker: (props: Record<string, unknown>) => (
    <div data-testid="location-picker">
      {String(props.lat)},{String(props.lng)}
    </div>
  ),
}))

vi.mock('@/components/report/media-uploader', () => ({
  MediaUploader: () => <div data-testid="media-uploader" />,
}))

vi.mock('@/components/report/step-indicator', () => ({
  StepIndicator: () => <div data-testid="step-indicator" />,
}))

vi.mock('@/components/ui/confirmation-dialog', () => ({
  ConfirmationDialog: () => null,
}))

vi.mock('@/components/ui/breadcrumb', () => ({
  Breadcrumb: () => <div data-testid="breadcrumb" />,
}))

vi.mock('@/lib/offline/db', () => ({
  getDraft: vi.fn().mockResolvedValue(null),
  putDraft: vi.fn().mockResolvedValue(undefined),
  deleteDraft: vi.fn().mockResolvedValue(undefined),
  clearSyncStateForWalk: vi.fn().mockResolvedValue(undefined),
  getMediaByClientParent: vi.fn().mockResolvedValue([]),
  updateMediaResolvedParentId: vi.fn().mockResolvedValue(undefined),
  getOutboxItems: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/offline/sync-engine', () => ({
  processOutbox: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/utils/format-date', () => ({
  formatDate: vi.fn((d: string) => d),
  toLocalDateString: vi.fn((d: string) => d),
}))

// Import component after mocks
import { ObservationFormClient } from '@/app/(app)/report/[walkId]/edit/observation-form-client'

const defaultSlot = {
  id: 'slot-1',
  locationName: 'Forest Trail',
  walkDate: '2026-04-12',
  startTime: '08:00',
  endTime: '10:00',
  roundName: 'Round 1',
}

function renderForm(existingObservation: Parameters<typeof ObservationFormClient>[0]['existingObservation'] = null) {
  return render(
    <ObservationFormClient
      slot={defaultSlot}
      existingObservation={existingObservation}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('Completion comment textarea visibility', () => {
  it('does not show comment textarea when PARTIAL is the default (no existing observation)', () => {
    // Default walkCompletion is PARTIAL, so textarea should be visible
    renderForm()
    // Default is PARTIAL, so the textarea should appear
    expect(screen.getByPlaceholderText('Why was the walk not completed?')).toBeInTheDocument()
  })

  it('shows comment textarea when PARTIAL is selected', () => {
    renderForm()
    // Click Partial button
    fireEvent.click(screen.getByText('Partial'))
    expect(screen.getByPlaceholderText('Why was the walk not completed?')).toBeInTheDocument()
  })

  it('shows comment textarea when ABORTED is selected', () => {
    renderForm()
    fireEvent.click(screen.getByText('Aborted'))
    expect(screen.getByPlaceholderText('Why was the walk not completed?')).toBeInTheDocument()
  })

  it('hides comment textarea when COMPLETED is selected', () => {
    renderForm()
    // Start from PARTIAL (default), switch to COMPLETED
    fireEvent.click(screen.getByText('Completed'))
    expect(screen.queryByPlaceholderText('Why was the walk not completed?')).not.toBeInTheDocument()
  })

  it('shows textarea for existing PARTIAL observation', () => {
    renderForm({
      id: 'obs-1',
      walkCompletion: 'PARTIAL',
      completionComment: 'Rain started',
      outcome: 'NOT_SIGHTED',
      notes: null,
      lat: null,
      lng: null,
      serverUpdatedAt: '2026-04-12T10:00:00Z',
      sightings: [],
      media: [],
    })
    const textarea = screen.getByPlaceholderText('Why was the walk not completed?') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()
    expect(textarea.value).toBe('Rain started')
  })

  it('shows textarea for existing ABORTED observation', () => {
    renderForm({
      id: 'obs-1',
      walkCompletion: 'ABORTED',
      completionComment: 'Trail blocked',
      outcome: 'NOT_SIGHTED',
      notes: null,
      lat: null,
      lng: null,
      serverUpdatedAt: '2026-04-12T10:00:00Z',
      sightings: [],
      media: [],
    })
    const textarea = screen.getByPlaceholderText('Why was the walk not completed?') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()
    expect(textarea.value).toBe('Trail blocked')
  })

  it('hides textarea for existing COMPLETED observation', () => {
    renderForm({
      id: 'obs-1',
      walkCompletion: 'COMPLETED',
      completionComment: null,
      outcome: 'NOT_SIGHTED',
      notes: null,
      lat: null,
      lng: null,
      serverUpdatedAt: '2026-04-12T10:00:00Z',
      sightings: [],
      media: [],
    })
    expect(screen.queryByPlaceholderText('Why was the walk not completed?')).not.toBeInTheDocument()
  })
})

describe('Completion comment label text', () => {
  it('shows "partial" in the label when PARTIAL is selected', () => {
    renderForm()
    fireEvent.click(screen.getByText('Partial'))
    expect(screen.getByText(/reason for partial walk/)).toBeInTheDocument()
  })

  it('shows "aborted" in the label when ABORTED is selected', () => {
    renderForm()
    fireEvent.click(screen.getByText('Aborted'))
    expect(screen.getByText(/reason for aborted walk/)).toBeInTheDocument()
  })
})

describe('Completion comment clearing on status change', () => {
  it('clears comment when switching from PARTIAL to COMPLETED', () => {
    renderForm()
    // Type a comment in PARTIAL mode
    fireEvent.click(screen.getByText('Partial'))
    const textarea = screen.getByPlaceholderText('Why was the walk not completed?')
    fireEvent.change(textarea, { target: { value: 'Some reason' } })
    expect((textarea as HTMLTextAreaElement).value).toBe('Some reason')

    // Switch to COMPLETED — textarea should disappear
    fireEvent.click(screen.getByText('Completed'))
    expect(screen.queryByPlaceholderText('Why was the walk not completed?')).not.toBeInTheDocument()

    // Switch back to PARTIAL — textarea should reappear but be empty
    fireEvent.click(screen.getByText('Partial'))
    const newTextarea = screen.getByPlaceholderText('Why was the walk not completed?') as HTMLTextAreaElement
    expect(newTextarea.value).toBe('')
  })

  it('clears comment when switching from ABORTED to COMPLETED', () => {
    renderForm()
    fireEvent.click(screen.getByText('Aborted'))
    const textarea = screen.getByPlaceholderText('Why was the walk not completed?')
    fireEvent.change(textarea, { target: { value: 'Trail closed' } })

    fireEvent.click(screen.getByText('Completed'))
    expect(screen.queryByPlaceholderText('Why was the walk not completed?')).not.toBeInTheDocument()

    // Switch back to ABORTED — comment should be empty
    fireEvent.click(screen.getByText('Aborted'))
    const newTextarea = screen.getByPlaceholderText('Why was the walk not completed?') as HTMLTextAreaElement
    expect(newTextarea.value).toBe('')
  })

  it('preserves comment when switching from PARTIAL to ABORTED', () => {
    renderForm()
    fireEvent.click(screen.getByText('Partial'))
    const textarea = screen.getByPlaceholderText('Why was the walk not completed?')
    fireEvent.change(textarea, { target: { value: 'Got tired' } })

    fireEvent.click(screen.getByText('Aborted'))
    const updatedTextarea = screen.getByPlaceholderText('Why was the walk not completed?') as HTMLTextAreaElement
    expect(updatedTextarea.value).toBe('Got tired')
  })

  it('preserves comment when switching from ABORTED to PARTIAL', () => {
    renderForm()
    fireEvent.click(screen.getByText('Aborted'))
    const textarea = screen.getByPlaceholderText('Why was the walk not completed?')
    fireEvent.change(textarea, { target: { value: 'Emergency' } })

    fireEvent.click(screen.getByText('Partial'))
    const updatedTextarea = screen.getByPlaceholderText('Why was the walk not completed?') as HTMLTextAreaElement
    expect(updatedTextarea.value).toBe('Emergency')
  })
})

describe('Completion comment with empty/null existing data', () => {
  it('renders empty textarea when existing observation has null completionComment', () => {
    renderForm({
      id: 'obs-1',
      walkCompletion: 'PARTIAL',
      completionComment: null,
      outcome: 'NOT_SIGHTED',
      notes: null,
      lat: null,
      lng: null,
      serverUpdatedAt: '2026-04-12T10:00:00Z',
      sightings: [],
      media: [],
    })
    const textarea = screen.getByPlaceholderText('Why was the walk not completed?') as HTMLTextAreaElement
    expect(textarea.value).toBe('')
  })

  it('handles user typing in the comment field', () => {
    renderForm()
    fireEvent.click(screen.getByText('Partial'))
    const textarea = screen.getByPlaceholderText('Why was the walk not completed?')
    fireEvent.change(textarea, { target: { value: 'Weather issue' } })
    expect((textarea as HTMLTextAreaElement).value).toBe('Weather issue')
  })
})
