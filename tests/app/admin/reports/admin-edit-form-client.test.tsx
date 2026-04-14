import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// ── Mocks ──────────────────────────────────────────────────────────────

const mockAdminUpdateObservation = vi.fn()
const mockAdminDeleteMedia = vi.fn()

vi.mock('@/lib/actions/admin-observation-actions', () => ({
  adminUpdateObservation: (...args: unknown[]) => mockAdminUpdateObservation(...args),
  adminDeleteMedia: (...args: unknown[]) => mockAdminDeleteMedia(...args),
}))

const mediaUploaderProps: Array<Record<string, unknown>> = []
vi.mock('@/components/report/media-uploader', () => ({
  MediaUploader: (props: Record<string, unknown>) => {
    mediaUploaderProps.push(props)
    return (
      <div data-testid="media-uploader">
        <span data-testid={`parent-type-${props.parentType}`}>{String(props.parentType)}</span>
        <span data-testid={`parent-id-${props.parentId}`}>{String(props.parentId)}</span>
      </div>
    )
  },
}))

vi.mock('@/components/map/location-picker', () => ({
  LocationPicker: (props: Record<string, unknown>) => (
    <div data-testid="location-picker">
      <button
        type="button"
        data-testid="set-location"
        onClick={() => (props.onLocationChange as (lat: number, lng: number) => void)(1.35, 103.82)}
      >
        Set Location
      </button>
    </div>
  ),
}))

vi.mock('@/components/ui/confirmation-dialog', () => ({
  ConfirmationDialog: (props: Record<string, unknown>) =>
    props.open ? (
      <div data-testid="confirmation-dialog">
        <p>{String(props.message)}</p>
        <button data-testid="confirm-btn" onClick={props.onConfirm as () => void}>
          {String(props.confirmLabel)}
        </button>
        <button data-testid="cancel-btn" onClick={props.onCancel as () => void}>
          Cancel
        </button>
      </div>
    ) : null,
}))

const mockPush = vi.fn()
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual('next/navigation')
  return {
    ...actual,
    useRouter: () => ({
      push: mockPush,
      replace: vi.fn(),
      back: vi.fn(),
      refresh: vi.fn(),
    }),
  }
})

import { AdminEditFormClient } from '@/app/(app)/admin/reports/[walkId]/[observationId]/edit/admin-edit-form-client'

// ── Fixtures ───────────────────────────────────────────────────────────

const defaultSlot = {
  id: 'slot-1',
  locationName: 'MacRitchie Trail',
  walkDate: '2026-04-01',
  startTime: '08:00:00',
  endTime: '10:00:00',
  roundName: 'Round 1',
}

interface MediaItem {
  id: string
  file_path: string
  file_name: string
  media_type: string
}

interface TestSighting {
  id: string
  species: string
  speciesOther: string | null
  count: string
  observedAt: string | null
  lat: number
  lng: number
  notes: string | null
  media: MediaItem[]
}

interface TestObservation {
  id: string
  userId: string
  userName: string
  slotId: string
  walkCompletion: string
  outcome: string
  notes: string | null
  lat: number | null
  lng: number | null
  status: string
  sightings: TestSighting[]
  media: MediaItem[]
}

const sightedObservation: TestObservation = {
  id: 'obs-1',
  userId: 'user-1',
  userName: 'Alice',
  slotId: 'slot-1',
  walkCompletion: 'COMPLETED',
  outcome: 'SIGHTED',
  notes: 'Saw primates',
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
      media: [{ id: 'm1', file_path: 'p.jpg', file_name: 'p.jpg', media_type: 'PHOTO' }],
    },
  ],
  media: [],
}

const notSightedObservation: TestObservation = {
  id: 'obs-2',
  userId: 'user-1',
  userName: 'Alice',
  slotId: 'slot-1',
  walkCompletion: 'COMPLETED',
  outcome: 'NOT_SIGHTED',
  notes: 'No primates today',
  lat: 1.35,
  lng: 103.82,
  status: 'SUBMITTED',
  sightings: [],
  media: [{ id: 'm2', file_path: 'q.jpg', file_name: 'q.jpg', media_type: 'PHOTO' }],
}

function renderForm(observation: TestObservation = sightedObservation) {
  return render(
    <AdminEditFormClient
      slot={defaultSlot}
      observation={observation}
      maxMediaPerReport={10}
    />
  )
}

// ── Tests ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mediaUploaderProps.length = 0
  mockPush.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('AdminEditFormClient', () => {
  // ─── Rendering ─────────────────────────────────────────────────────

  describe('rendering', () => {
    it('shows the admin warning banner', () => {
      renderForm()
      expect(
        screen.getByText(/editing this report as an admin/i)
      ).toBeInTheDocument()
    })

    it('displays the reporter name and walk info in the header', () => {
      renderForm()
      expect(screen.getByText('Edit Report')).toBeInTheDocument()
      expect(screen.getByText(/Alice/)).toBeInTheDocument()
      expect(screen.getByText(/MacRitchie Trail/)).toBeInTheDocument()
    })

    it('pre-fills walk completion selection', () => {
      renderForm()
      // The COMPLETED button should be active (green)
      const completedBtn = screen.getByText('Completed')
      expect(completedBtn.className).toContain('bg-green-600')
    })

    it('pre-fills sighting data', () => {
      renderForm()
      expect(screen.getByText('Sighting #1')).toBeInTheDocument()
      expect(screen.getByDisplayValue('3')).toBeInTheDocument()
      expect(screen.getByDisplayValue('2026-04-01T08:30')).toBeInTheDocument()
    })

    it('pre-fills notes', () => {
      renderForm()
      expect(screen.getByDisplayValue('Saw primates')).toBeInTheDocument()
    })

    it('shows Cancel and Save Changes buttons', () => {
      renderForm()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })

    it('Cancel button links back to admin walk report page', () => {
      renderForm()
      const cancelLink = screen.getByText('Cancel')
      expect(cancelLink.getAttribute('href')).toBe('/admin/reports/slot-1')
    })

    it('shows back arrow linking to admin walk report page', () => {
      renderForm()
      const backLinks = screen.getAllByRole('link')
      const backLink = backLinks.find(
        (el) => el.getAttribute('href') === '/admin/reports/slot-1'
      )
      expect(backLink).toBeDefined()
    })
  })

  // ─── NOT_SIGHTED rendering ────────────────────────────────────────

  describe('NOT_SIGHTED rendering', () => {
    it('shows Walk Location section when no sightings', () => {
      renderForm(notSightedObservation)
      expect(screen.getByText('Walk Location')).toBeInTheDocument()
    })

    it('shows observation-level media when no sightings', () => {
      renderForm(notSightedObservation)
      // Should render MediaUploader for observation-level media
      const uploaders = screen.getAllByTestId('media-uploader')
      expect(uploaders.length).toBeGreaterThanOrEqual(1)
    })

    it('does NOT show Walk Location when there are sightings', () => {
      renderForm(sightedObservation)
      expect(screen.queryByText('Walk Location')).not.toBeInTheDocument()
    })

    it('shows empty sightings message for NOT_SIGHTED report', () => {
      renderForm(notSightedObservation)
      expect(screen.getByText(/No sightings/)).toBeInTheDocument()
    })
  })

  // ─── Sighting management ──────────────────────────────────────────

  describe('sighting management', () => {
    it('adds a new sighting when Add Sighting is clicked', () => {
      renderForm()
      expect(screen.getByText('Sighting #1')).toBeInTheDocument()
      expect(screen.queryByText('Sighting #2')).not.toBeInTheDocument()

      fireEvent.click(screen.getByText('Add Sighting'))

      expect(screen.getByText('Sighting #2')).toBeInTheDocument()
    })

    it('removes a sighting when trash button is clicked', () => {
      renderForm()
      expect(screen.getByText('Sighting #1')).toBeInTheDocument()

      // Click the delete button (Trash2 icon button)
      const deleteButtons = screen.getAllByRole('button').filter((btn) =>
        btn.querySelector('svg')
      )
      // Find the trash button in the sighting card
      const trashBtn = deleteButtons.find((btn) => {
        const parent = btn.closest('.border.border-gray-200')
        return parent !== null
      })
      if (trashBtn) fireEvent.click(trashBtn)

      expect(screen.queryByText('Sighting #1')).not.toBeInTheDocument()
    })

    it('shows species name field when OTHER is selected', () => {
      renderForm()
      fireEvent.click(screen.getByText('Add Sighting'))

      const selects = screen.getAllByRole('combobox')
      const newSelect = selects[selects.length - 1]
      fireEvent.change(newSelect, { target: { value: 'OTHER' } })

      expect(screen.getByPlaceholderText('Enter species name...')).toBeInTheDocument()
    })

    it('shows count/time/location fields only after species is selected', () => {
      renderForm()
      fireEvent.click(screen.getByText('Add Sighting'))

      // Before selecting species, extra fields should not be visible
      // (the new sighting has species = '')
      const sighting2Section = screen.getByText('Sighting #2').closest('.border')
      expect(sighting2Section).toBeDefined()

      // Select a species for the new sighting
      const selects = screen.getAllByRole('combobox')
      const newSelect = selects[selects.length - 1]
      fireEvent.change(newSelect, { target: { value: 'LTM' } })

      // Now should see the location picker for the new sighting
      const locationPickers = screen.getAllByTestId('location-picker')
      expect(locationPickers.length).toBeGreaterThan(1)
    })
  })

  // ─── Walk completion ──────────────────────────────────────────────

  describe('walk completion', () => {
    it('changes walk completion when a different option is clicked', () => {
      renderForm()

      const partialBtn = screen.getByText('Partial')
      fireEvent.click(partialBtn)

      expect(partialBtn.className).toContain('bg-green-600')
      expect(screen.getByText('Completed').className).toContain('bg-gray-100')
    })
  })

  // ─── Validation ───────────────────────────────────────────────────

  describe('validation', () => {
    it('shows error when OTHER species has no name', () => {
      renderForm({
        ...sightedObservation,
        sightings: [
          {
            id: 'sight-other',
            species: 'OTHER',
            speciesOther: '',
            count: '1',
            observedAt: null,
            lat: 1.36,
            lng: 103.83,
            notes: null,
            media: [],
          },
        ],
      })

      fireEvent.click(screen.getByText('Save Changes'))

      expect(
        screen.getByText('Species name is required when "Other" is selected.')
      ).toBeInTheDocument()
    })

    it('shows error when sighting has no GPS', () => {
      renderForm({
        ...sightedObservation,
        sightings: [
          {
            id: 'sight-no-gps',
            species: 'RBL',
            speciesOther: null,
            count: '1',
            observedAt: null,
            lat: 0,
            lng: 0,
            notes: null,
            media: [],
          },
        ],
      })

      fireEvent.click(screen.getByText('Save Changes'))

      expect(
        screen.getByText('GPS location is required for each sighting.')
      ).toBeInTheDocument()
    })

    it('shows error when NOT_SIGHTED has no GPS', () => {
      renderForm({
        ...notSightedObservation,
        lat: null,
        lng: null,
      })

      // Remove any existing sightings (should already be empty)
      fireEvent.click(screen.getByText('Save Changes'))

      expect(
        screen.getByText('GPS location is required for Not Sighted reports.')
      ).toBeInTheDocument()
    })

    it('does not show confirmation dialog when validation fails', () => {
      renderForm({
        ...sightedObservation,
        sightings: [
          {
            id: 'sight-no-gps',
            species: 'RBL',
            speciesOther: null,
            count: '1',
            observedAt: null,
            lat: 0,
            lng: 0,
            notes: null,
            media: [],
          },
        ],
      })

      fireEvent.click(screen.getByText('Save Changes'))

      expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument()
    })
  })

  // ─── Save flow ────────────────────────────────────────────────────

  describe('save flow', () => {
    it('shows confirmation dialog when Save Changes is clicked with valid data', () => {
      renderForm()

      fireEvent.click(screen.getByText('Save Changes'))

      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument()
      expect(
        screen.getByText(/overwrite the original submission/i)
      ).toBeInTheDocument()
    })

    it('calls adminUpdateObservation on confirm', async () => {
      mockAdminUpdateObservation.mockResolvedValueOnce({ success: true })
      renderForm()

      fireEvent.click(screen.getByText('Save Changes'))
      fireEvent.click(screen.getByTestId('confirm-btn'))

      await waitFor(() => {
        expect(mockAdminUpdateObservation).toHaveBeenCalledWith(
          expect.objectContaining({
            observationId: 'obs-1',
            walkId: 'slot-1',
            walkCompletion: 'COMPLETED',
            outcome: 'SIGHTED',
            notes: 'Saw primates',
            sightings: expect.arrayContaining([
              expect.objectContaining({
                id: 'sight-1',
                species: 'RBL',
                count: '3',
              }),
            ]),
          })
        )
      })
    })

    it('navigates to walk report page on successful save', async () => {
      mockAdminUpdateObservation.mockResolvedValueOnce({ success: true })
      renderForm()

      fireEvent.click(screen.getByText('Save Changes'))
      fireEvent.click(screen.getByTestId('confirm-btn'))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/admin/reports/slot-1')
      })
    })

    it('shows error message when save fails', async () => {
      mockAdminUpdateObservation.mockResolvedValueOnce({
        error: 'Database error occurred',
      })
      renderForm()

      fireEvent.click(screen.getByText('Save Changes'))
      fireEvent.click(screen.getByTestId('confirm-btn'))

      await waitFor(() => {
        expect(screen.getByText('Database error occurred')).toBeInTheDocument()
      })
    })

    it('does not navigate when save fails', async () => {
      mockAdminUpdateObservation.mockResolvedValueOnce({
        error: 'DB error',
      })
      renderForm()

      fireEvent.click(screen.getByText('Save Changes'))
      fireEvent.click(screen.getByTestId('confirm-btn'))

      await waitFor(() => {
        expect(screen.getByText('DB error')).toBeInTheDocument()
      })
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('closes confirmation dialog when Cancel is clicked', () => {
      renderForm()

      fireEvent.click(screen.getByText('Save Changes'))
      expect(screen.getByTestId('confirmation-dialog')).toBeInTheDocument()

      fireEvent.click(screen.getByTestId('cancel-btn'))
      expect(screen.queryByTestId('confirmation-dialog')).not.toBeInTheDocument()
    })

    it('sends outcome as NOT_SIGHTED when all sightings are removed', async () => {
      // Start with a sighted observation, then remove the sighting.
      // But we also need GPS set for validation to pass.
      mockAdminUpdateObservation.mockResolvedValueOnce({ success: true })

      const obsWithGps = {
        ...sightedObservation,
        lat: 1.35,
        lng: 103.82,
      }
      renderForm(obsWithGps)

      // Remove the sighting
      const deleteButtons = screen.getAllByRole('button').filter((btn) =>
        btn.querySelector('svg')
      )
      const trashBtn = deleteButtons.find((btn) => {
        const parent = btn.closest('.border.border-gray-200')
        return parent !== null
      })
      if (trashBtn) fireEvent.click(trashBtn)

      // Now set location via LocationPicker mock
      fireEvent.click(screen.getByTestId('set-location'))

      fireEvent.click(screen.getByText('Save Changes'))
      fireEvent.click(screen.getByTestId('confirm-btn'))

      await waitFor(() => {
        expect(mockAdminUpdateObservation).toHaveBeenCalledWith(
          expect.objectContaining({
            outcome: 'NOT_SIGHTED',
            sightings: [],
          })
        )
      })
    })

    it('sends empty species_other for non-OTHER species', async () => {
      mockAdminUpdateObservation.mockResolvedValueOnce({ success: true })
      renderForm()

      fireEvent.click(screen.getByText('Save Changes'))
      fireEvent.click(screen.getByTestId('confirm-btn'))

      await waitFor(() => {
        const call = mockAdminUpdateObservation.mock.calls[0][0]
        const rblSighting = call.sightings.find(
          (s: Record<string, unknown>) => s.species === 'RBL'
        )
        expect(rblSighting.species_other).toBeFalsy()
      })
    })
  })

  // ─── MediaUploader integration ────────────────────────────────────

  describe('MediaUploader integration', () => {
    it('passes onDeleteMedia=adminDeleteMedia to sighting MediaUploader', () => {
      renderForm()

      // The sighting media uploader should have been rendered
      const sightingUploader = mediaUploaderProps.find(
        (p) => p.parentType === 'sighting'
      )
      expect(sightingUploader).toBeDefined()
      expect(sightingUploader!.onDeleteMedia).toBeDefined()
    })

    it('passes correct parentId to sighting MediaUploader', () => {
      renderForm()

      const sightingUploader = mediaUploaderProps.find(
        (p) => p.parentType === 'sighting'
      )
      expect(sightingUploader!.parentId).toBe('sight-1')
    })

    it('passes onDeleteMedia to observation-level MediaUploader for NOT_SIGHTED', () => {
      renderForm(notSightedObservation)

      const obsUploader = mediaUploaderProps.find(
        (p) => p.parentType === 'observation'
      )
      expect(obsUploader).toBeDefined()
      expect(obsUploader!.onDeleteMedia).toBeDefined()
    })

    it('passes existing media to sighting MediaUploader', () => {
      renderForm()

      const sightingUploader = mediaUploaderProps.find(
        (p) => p.parentType === 'sighting'
      )
      expect(sightingUploader!.existingMedia).toEqual([
        { id: 'm1', file_path: 'p.jpg', file_name: 'p.jpg', media_type: 'PHOTO' },
      ])
    })

    it('passes existing media to observation-level MediaUploader for NOT_SIGHTED', () => {
      renderForm(notSightedObservation)

      const obsUploader = mediaUploaderProps.find(
        (p) => p.parentType === 'observation'
      )
      expect(obsUploader!.existingMedia).toEqual([
        { id: 'm2', file_path: 'q.jpg', file_name: 'q.jpg', media_type: 'PHOTO' },
      ])
    })

    it('passes maxFiles to MediaUploader', () => {
      renderForm()

      const sightingUploader = mediaUploaderProps.find(
        (p) => p.parentType === 'sighting'
      )
      expect(sightingUploader!.maxFiles).toBe(10)
    })
  })

  // ─── Notes editing ────────────────────────────────────────────────

  describe('notes editing', () => {
    it('allows changing notes text', () => {
      renderForm()

      const textarea = screen.getByDisplayValue('Saw primates')
      fireEvent.change(textarea, { target: { value: 'Updated notes' } })

      expect(screen.getByDisplayValue('Updated notes')).toBeInTheDocument()
    })

    it('sends updated notes in save payload', async () => {
      mockAdminUpdateObservation.mockResolvedValueOnce({ success: true })
      renderForm()

      const textarea = screen.getByDisplayValue('Saw primates')
      fireEvent.change(textarea, { target: { value: 'Admin correction' } })

      fireEvent.click(screen.getByText('Save Changes'))
      fireEvent.click(screen.getByTestId('confirm-btn'))

      await waitFor(() => {
        expect(mockAdminUpdateObservation).toHaveBeenCalledWith(
          expect.objectContaining({ notes: 'Admin correction' })
        )
      })
    })
  })
})
