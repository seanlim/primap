import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { ToastProvider, useToast } from '@/components/ui/toast'

function TestComponent({ type = 'success' }: { type?: 'success' | 'error' | 'info' }) {
  const { showToast } = useToast()
  return (
    <button onClick={() => showToast('Test message', type)}>Show</button>
  )
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    if (!globalThis.crypto?.randomUUID) {
      vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue('test-id') })
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('showToast adds a toast that renders', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show'))
    })

    expect(screen.getByText('Test message')).toBeInTheDocument()
  })

  it('toast auto-dismisses after 4 seconds', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show'))
    })

    expect(screen.getByText('Test message')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.queryByText('Test message')).not.toBeInTheDocument()
  })

  it('dismiss button removes toast immediately', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show'))
    })

    expect(screen.getByText('Test message')).toBeInTheDocument()

    const dismissButton = screen.getByText('Test message')
      .closest('div[class*="flex items-center"]')!
      .querySelector('button')!
    fireEvent.click(dismissButton)

    expect(screen.queryByText('Test message')).not.toBeInTheDocument()
  })

  it('success type renders with green background class', () => {
    render(
      <ToastProvider>
        <TestComponent type="success" />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show'))
    })

    const toast = screen.getByText('Test message').closest('div[class*="flex items-center"]')
    expect(toast?.className).toContain('bg-green-600')
  })

  it('error type renders with red background class', () => {
    render(
      <ToastProvider>
        <TestComponent type="error" />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show'))
    })

    const toast = screen.getByText('Test message').closest('div[class*="flex items-center"]')
    expect(toast?.className).toContain('bg-red-600')
  })

  it('info type renders with gray background class', () => {
    render(
      <ToastProvider>
        <TestComponent type="info" />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Show'))
    })

    const toast = screen.getByText('Test message').closest('div[class*="flex items-center"]')
    expect(toast?.className).toContain('bg-gray-800')
  })

  it('useToast returns context', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ToastProvider>{children}</ToastProvider>
    )
    const { result } = renderHook(() => useToast(), { wrapper })
    expect(typeof result.current.showToast).toBe('function')
  })
})
