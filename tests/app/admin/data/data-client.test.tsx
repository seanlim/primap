import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockShowToast = vi.fn()

// Mock toast
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

import { DataClient } from '@/app/(app)/admin/data/data-client'

describe('DataClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all three sections', () => {
    render(<DataClient />)

    expect(screen.getByText('Export Data')).toBeInTheDocument()
    expect(screen.getByText('Restore from Backup')).toBeInTheDocument()
    expect(screen.getByText('Import Legacy Data')).toBeInTheDocument()
  })

  it('renders export, restore, and import buttons', () => {
    render(<DataClient />)

    expect(screen.getByText('Export Backup')).toBeInTheDocument()
    expect(screen.getByText('Export for Viewing')).toBeInTheDocument()
    expect(screen.getByText('Upload & Restore')).toBeInTheDocument()
    expect(screen.getByText('Validate & Import')).toBeInTheDocument()
  })

  it('renders back link to admin dashboard', () => {
    render(<DataClient />)

    const backLink = screen.getByRole('link')
    expect(backLink).toHaveAttribute('href', '/admin')
  })

  it('renders file inputs for restore and legacy import', () => {
    render(<DataClient />)

    const fileInputs = document.querySelectorAll('input[type="file"]')
    expect(fileInputs).toHaveLength(2)
    expect(fileInputs[0]).toHaveAttribute('accept', '.zip')
    expect(fileInputs[1]).toHaveAttribute('accept', '.xlsx')
  })

  describe('file picker trigger on empty click', () => {
    it('opens file picker when clicking Upload & Restore without a file selected', () => {
      render(<DataClient />)

      const fileInput = document.querySelector('input[accept=".zip"]') as HTMLInputElement
      const clickSpy = vi.spyOn(fileInput, 'click')

      const button = screen.getByText('Upload & Restore')
      fireEvent.click(button)

      expect(clickSpy).toHaveBeenCalled()
    })

    it('opens file picker when clicking Validate & Import without a file selected', () => {
      render(<DataClient />)

      const fileInput = document.querySelector('input[accept=".xlsx"]') as HTMLInputElement
      const clickSpy = vi.spyOn(fileInput, 'click')

      const button = screen.getByText('Validate & Import')
      fireEvent.click(button)

      expect(clickSpy).toHaveBeenCalled()
    })
  })

  it('shows expected column format for legacy import', () => {
    render(<DataClient />)

    expect(screen.getByText(/round_name, location_name/)).toBeInTheDocument()
    expect(screen.getByText(/observer_email/)).toBeInTheDocument()
  })

  it('shows warning about existing rounds and accounts', () => {
    render(<DataClient />)

    expect(screen.getByText(/Rounds and observer accounts must already exist/)).toBeInTheDocument()
  })

  it('shows note about existing data not being overwritten', () => {
    render(<DataClient />)

    expect(screen.getByText(/Existing data will NOT be overwritten/)).toBeInTheDocument()
  })

  it('explains the difference between backup and view exports', () => {
    render(<DataClient />)

    expect(screen.getByText(/Backup export preserves the restore format/)).toBeInTheDocument()
    expect(screen.getByText(/View export creates readable report sheets/)).toBeInTheDocument()
  })

  it('shows info toast when view export has media warnings', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['zip'])),
      headers: {
        get: vi.fn((name: string) => {
          if (name === 'Content-Disposition') return 'attachment; filename="primap-view-export-test.zip"'
          if (name === 'X-Export-Warning-Count') return '2'
          return null
        }),
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    })

    render(<DataClient />)
    fireEvent.click(screen.getByText('Export for Viewing'))

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'View export downloaded with 2 media warning(s). See export-warnings.txt inside the zip.',
        'info'
      )
    })

    vi.unstubAllGlobals()
  })
})
