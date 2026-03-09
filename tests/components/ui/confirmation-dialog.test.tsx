import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'

const defaultProps = {
  open: true,
  title: 'Delete item?',
  message: 'This action cannot be undone.',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
}

function renderDialog(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides }
  return render(<ConfirmationDialog {...props} />)
}

describe('ConfirmationDialog', () => {
  it('returns null when not open', () => {
    const { container } = renderDialog({ open: false })
    expect(container.innerHTML).toBe('')
  })

  it('renders title and message when open', () => {
    renderDialog()
    expect(screen.getByText('Delete item?')).toBeInTheDocument()
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
  })

  it('uses default confirm/cancel labels', () => {
    renderDialog()
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('uses custom confirm/cancel labels', () => {
    renderDialog({ confirmLabel: 'Yes, delete', cancelLabel: 'No, keep' } as any)
    expect(screen.getByText('Yes, delete')).toBeInTheDocument()
    expect(screen.getByText('No, keep')).toBeInTheDocument()
  })

  it('calls onConfirm on confirm click', () => {
    const onConfirm = vi.fn()
    renderDialog({ onConfirm })
    fireEvent.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel on cancel click', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel on backdrop click', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    const backdrop = document.querySelector('.bg-black\\/50')
    fireEvent.click(backdrop!)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does NOT call onCancel on backdrop click when busy', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel, busy: true } as any)
    const backdrop = document.querySelector('.bg-black\\/50')
    fireEvent.click(backdrop!)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('escape key calls onCancel', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel })
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('escape key does NOT call onCancel when busy', () => {
    const onCancel = vi.fn()
    renderDialog({ onCancel, busy: true } as any)
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('destructive variant applies red styling', () => {
    renderDialog({ destructive: true } as any)
    const confirmButton = screen.getByText('Confirm')
    expect(confirmButton.className).toContain('bg-red')
  })

  it('buttons are disabled when busy', () => {
    renderDialog({ busy: true } as any)
    expect(screen.getByText('Confirm')).toBeDisabled()
    expect(screen.getByText('Cancel')).toBeDisabled()
  })
})
