import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// ─── Mocks ──────────────────────────────────────────────────────────────────
//
// IncidentModal calls reportIncident and renders MediaUploader. We mock both
// so the test exercises the modal's own logic (phase transitions, button
// states, callback wiring) without touching the network or DB.

const reportIncident = vi.fn()
vi.mock('@/lib/actions/incident-actions', () => ({
  reportIncident: (...args: unknown[]) => reportIncident(...args),
}))

// Capture every render of MediaUploader so tests can assert props and trigger
// the onUploadingChange callback to simulate in-flight uploads.
const mediaUploaderProps: Array<Record<string, unknown>> = []
vi.mock('@/components/report/media-uploader', () => ({
  MediaUploader: (props: Record<string, unknown>) => {
    mediaUploaderProps.push(props)
    return (
      <div data-testid="media-uploader">
        <span data-testid="parent-type">{String(props.parentType)}</span>
        <span data-testid="parent-id">{String(props.parentId)}</span>
        <button
          type="button"
          data-testid="simulate-upload-start"
          onClick={() => (props.onUploadingChange as (n: number) => void)?.(2)}
        >
          start uploads
        </button>
        <button
          type="button"
          data-testid="simulate-upload-end"
          onClick={() => (props.onUploadingChange as (n: number) => void)?.(0)}
        >
          end uploads
        </button>
      </div>
    )
  },
}))

// Import after mocks
import { IncidentModal } from '@/app/(app)/report/[walkId]/incident-modal'

const defaultProps = {
  walkId: 'slot-1',
  onClose: vi.fn(),
  onSubmitted: vi.fn(),
}

function renderModal(overrides: Partial<typeof defaultProps> = {}) {
  return render(<IncidentModal {...defaultProps} {...overrides} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mediaUploaderProps.length = 0
  defaultProps.onClose = vi.fn()
  defaultProps.onSubmitted = vi.fn()
})

afterEach(() => {
  cleanup()
})

describe('IncidentModal', () => {
  describe('Phase 1 (Details)', () => {
    it('renders through document.body so the mobile bottom nav cannot cover it', () => {
      renderModal()

      expect(screen.getByTestId('incident-modal-root').parentElement).toBe(document.body)
      expect(screen.getByTestId('incident-modal-root')).toHaveClass('fixed', 'inset-0')
      expect(screen.getByTestId('incident-modal-root')).toHaveStyle({ zIndex: '1000' })
    })

    it('renders the details form with type select and description textarea', () => {
      renderModal()
      expect(screen.getByText('Report Incident')).toBeInTheDocument()
      expect(screen.getByText('Incident Type')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Describe the incident...')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Report')).toBeInTheDocument()
    })

    it('disables the Report button when type is empty', () => {
      renderModal()
      const btn = screen.getByText('Report') as HTMLButtonElement
      expect(btn).toBeDisabled()
    })

    it('disables the Report button when description is empty (only type set)', () => {
      renderModal()
      const select = screen.getByRole('combobox') as HTMLSelectElement
      fireEvent.change(select, { target: { value: 'INJURED_ANIMAL' } })
      const btn = screen.getByText('Report') as HTMLButtonElement
      expect(btn).toBeDisabled()
    })

    it('enables the Report button when both fields are filled', () => {
      renderModal()
      const select = screen.getByRole('combobox') as HTMLSelectElement
      const textarea = screen.getByPlaceholderText('Describe the incident...') as HTMLTextAreaElement
      fireEvent.change(select, { target: { value: 'DEAD_ANIMAL' } })
      fireEvent.change(textarea, { target: { value: 'Found a dead macaque' } })
      const btn = screen.getByText('Report') as HTMLButtonElement
      expect(btn).not.toBeDisabled()
    })

    it('Cancel calls onClose and does NOT call reportIncident', () => {
      const onClose = vi.fn()
      renderModal({ onClose })
      fireEvent.click(screen.getByText('Cancel'))
      expect(onClose).toHaveBeenCalledOnce()
      expect(reportIncident).not.toHaveBeenCalled()
    })

    it('shows error message and stays in phase 1 when reportIncident returns an error', async () => {
      reportIncident.mockResolvedValueOnce({ error: 'Only walk participants can report' })
      renderModal()

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'INJURED_ANIMAL' } })
      fireEvent.change(screen.getByPlaceholderText('Describe the incident...'), {
        target: { value: 'urgent' },
      })
      fireEvent.click(screen.getByText('Report'))

      await waitFor(() => {
        expect(screen.getByText('Only walk participants can report')).toBeInTheDocument()
      })
      // Still on phase 1
      expect(screen.getByText('Report Incident')).toBeInTheDocument()
      expect(screen.queryByText('Add Photos / Videos')).not.toBeInTheDocument()
    })

    it('transitions to phase 2 on successful submission and passes incidentId to MediaUploader', async () => {
      reportIncident.mockResolvedValueOnce({ success: true, incidentId: 'inc-42' })
      renderModal()

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'INJURED_ANIMAL' } })
      fireEvent.change(screen.getByPlaceholderText('Describe the incident...'), {
        target: { value: 'urgent' },
      })
      fireEvent.click(screen.getByText('Report'))

      await waitFor(() => {
        expect(screen.getByText('Add Photos / Videos')).toBeInTheDocument()
      })
      expect(screen.getByTestId('media-uploader')).toBeInTheDocument()
      expect(screen.getByTestId('parent-type')).toHaveTextContent('incident')
      expect(screen.getByTestId('parent-id')).toHaveTextContent('inc-42')
    })

    it('passes correct incidentType and walkId to reportIncident', async () => {
      reportIncident.mockResolvedValueOnce({ success: true, incidentId: 'inc-1' })
      renderModal({ walkId: 'walk-abc' })

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'HABITAT_DAMAGE' } })
      fireEvent.change(screen.getByPlaceholderText('Describe the incident...'), {
        target: { value: 'cleared trees on trail' },
      })
      fireEvent.click(screen.getByText('Report'))

      await waitFor(() => {
        expect(reportIncident).toHaveBeenCalledWith({
          walkId: 'walk-abc',
          incidentType: 'HABITAT_DAMAGE',
          description: 'cleared trees on trail',
        })
      })
    })
  })

  describe('Phase 2 (Add media)', () => {
    async function advanceToPhase2(incidentId = 'inc-1') {
      reportIncident.mockResolvedValueOnce({ success: true, incidentId })
      renderModal()
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'INJURED_ANIMAL' } })
      fireEvent.change(screen.getByPlaceholderText('Describe the incident...'), {
        target: { value: 'urgent' },
      })
      fireEvent.click(screen.getByText('Report'))
      await waitFor(() => {
        expect(screen.getByText('Add Photos / Videos')).toBeInTheDocument()
      })
    }

    it('renders MediaUploader with parentType=incident', async () => {
      await advanceToPhase2('inc-99')
      const lastUploader = mediaUploaderProps[mediaUploaderProps.length - 1]
      expect(lastUploader.parentType).toBe('incident')
      expect(lastUploader.parentId).toBe('inc-99')
      expect(lastUploader.existingMedia).toEqual([])
    })

    it('Done button calls onSubmitted', async () => {
      const onSubmitted = vi.fn()
      reportIncident.mockResolvedValueOnce({ success: true, incidentId: 'inc-1' })
      render(<IncidentModal {...defaultProps} onSubmitted={onSubmitted} />)
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'INJURED_ANIMAL' } })
      fireEvent.change(screen.getByPlaceholderText('Describe the incident...'), {
        target: { value: 'urgent' },
      })
      fireEvent.click(screen.getByText('Report'))
      await waitFor(() => screen.getByText('Done'))

      fireEvent.click(screen.getByText('Done'))
      expect(onSubmitted).toHaveBeenCalledOnce()
    })

    it('Skip button calls onSubmitted (text-only submission is valid)', async () => {
      const onSubmitted = vi.fn()
      reportIncident.mockResolvedValueOnce({ success: true, incidentId: 'inc-1' })
      render(<IncidentModal {...defaultProps} onSubmitted={onSubmitted} />)
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'INJURED_ANIMAL' } })
      fireEvent.change(screen.getByPlaceholderText('Describe the incident...'), {
        target: { value: 'urgent' },
      })
      fireEvent.click(screen.getByText('Report'))
      await waitFor(() => screen.getByText('Skip'))

      fireEvent.click(screen.getByText('Skip'))
      expect(onSubmitted).toHaveBeenCalledOnce()
    })

    it('blocks backdrop dismiss while uploads are in flight', async () => {
      const onSubmitted = vi.fn()
      reportIncident.mockResolvedValueOnce({ success: true, incidentId: 'inc-1' })
      render(<IncidentModal {...defaultProps} onSubmitted={onSubmitted} />)
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'INJURED_ANIMAL' } })
      fireEvent.change(screen.getByPlaceholderText('Describe the incident...'), {
        target: { value: 'urgent' },
      })
      fireEvent.click(screen.getByText('Report'))
      await waitFor(() => screen.getByTestId('media-uploader'))

      // Simulate uploads starting
      fireEvent.click(screen.getByTestId('simulate-upload-start'))

      // Backdrop click should be a no-op while uploading
      const backdrop = document.querySelector('.bg-black\\/50')
      fireEvent.click(backdrop!)
      expect(onSubmitted).not.toHaveBeenCalled()

      // Done and Skip should be disabled while uploading
      expect(screen.getByText('Done')).toBeDisabled()
      expect(screen.getByText('Skip')).toBeDisabled()

      // Status message should be visible
      expect(screen.getByRole('status')).toHaveTextContent(/Uploading 2 files/)
    })

    it('re-enables dismissal after uploads complete', async () => {
      const onSubmitted = vi.fn()
      reportIncident.mockResolvedValueOnce({ success: true, incidentId: 'inc-1' })
      render(<IncidentModal {...defaultProps} onSubmitted={onSubmitted} />)
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'INJURED_ANIMAL' } })
      fireEvent.change(screen.getByPlaceholderText('Describe the incident...'), {
        target: { value: 'urgent' },
      })
      fireEvent.click(screen.getByText('Report'))
      await waitFor(() => screen.getByTestId('media-uploader'))

      // Start then end uploads
      fireEvent.click(screen.getByTestId('simulate-upload-start'))
      fireEvent.click(screen.getByTestId('simulate-upload-end'))

      // Done and Skip should be enabled again
      expect(screen.getByText('Done')).not.toBeDisabled()
      expect(screen.getByText('Skip')).not.toBeDisabled()

      // Backdrop click should now finalize
      const backdrop = document.querySelector('.bg-black\\/50')
      fireEvent.click(backdrop!)
      expect(onSubmitted).toHaveBeenCalledOnce()
    })

    it('backdrop click in phase 2 (no uploads) calls onSubmitted', async () => {
      const onSubmitted = vi.fn()
      reportIncident.mockResolvedValueOnce({ success: true, incidentId: 'inc-1' })
      render(<IncidentModal {...defaultProps} onSubmitted={onSubmitted} />)
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'INJURED_ANIMAL' } })
      fireEvent.change(screen.getByPlaceholderText('Describe the incident...'), {
        target: { value: 'urgent' },
      })
      fireEvent.click(screen.getByText('Report'))
      await waitFor(() => screen.getByTestId('media-uploader'))

      const backdrop = document.querySelector('.bg-black\\/50')
      fireEvent.click(backdrop!)
      expect(onSubmitted).toHaveBeenCalledOnce()
    })
  })

  describe('Phase 1 backdrop dismiss', () => {
    it('backdrop click in phase 1 calls onClose (not onSubmitted)', () => {
      const onClose = vi.fn()
      const onSubmitted = vi.fn()
      render(<IncidentModal walkId="slot-1" onClose={onClose} onSubmitted={onSubmitted} />)
      const backdrop = document.querySelector('.bg-black\\/50')
      fireEvent.click(backdrop!)
      expect(onClose).toHaveBeenCalledOnce()
      expect(onSubmitted).not.toHaveBeenCalled()
    })
  })
})
