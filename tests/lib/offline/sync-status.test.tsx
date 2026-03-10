import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { SyncStatusProvider, useSyncStatus } from '@/lib/offline/sync-status'

// Mock dependencies
const mockGetOutboxItems = vi.fn()
const mockProcessOutbox = vi.fn()

vi.mock('@/lib/offline/db', () => ({
  getOutboxItems: (...args: unknown[]) => mockGetOutboxItems(...args),
}))

vi.mock('@/lib/offline/sync-engine', () => ({
  processOutbox: (...args: unknown[]) => mockProcessOutbox(...args),
}))

function TestConsumer() {
  const { isOnline, pendingCount, isSyncing, syncNow } = useSyncStatus()
  return (
    <div>
      <span data-testid="online">{String(isOnline)}</span>
      <span data-testid="pending">{pendingCount}</span>
      <span data-testid="syncing">{String(isSyncing)}</span>
      <button data-testid="sync" onClick={syncNow}>Sync</button>
    </div>
  )
}

describe('SyncStatusProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetOutboxItems.mockResolvedValue([])
    mockProcessOutbox.mockResolvedValue(0)
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
  })

  it('initializes with online status and zero pending count', async () => {
    render(
      <SyncStatusProvider>
        <TestConsumer />
      </SyncStatusProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('online').textContent).toBe('true')
      expect(screen.getByTestId('pending').textContent).toBe('0')
      expect(screen.getByTestId('syncing').textContent).toBe('false')
    })
  })

  it('refreshes pending count from outbox', async () => {
    mockGetOutboxItems.mockResolvedValue([{ id: 1 }, { id: 2 }])

    render(
      <SyncStatusProvider>
        <TestConsumer />
      </SyncStatusProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('pending').textContent).toBe('2')
    })
  })

  it('handles offline event', async () => {
    render(
      <SyncStatusProvider>
        <TestConsumer />
      </SyncStatusProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('online').textContent).toBe('true')
    })

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      window.dispatchEvent(new Event('offline'))
    })

    expect(screen.getByTestId('online').textContent).toBe('false')
  })

  it('syncs on online event', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    render(
      <SyncStatusProvider>
        <TestConsumer />
      </SyncStatusProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('online').textContent).toBe('false')
    })

    mockProcessOutbox.mockResolvedValue(1)

    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      window.dispatchEvent(new Event('online'))
    })

    expect(screen.getByTestId('online').textContent).toBe('true')
    expect(mockProcessOutbox).toHaveBeenCalled()
  })

  it('syncNow processes outbox and refreshes count', async () => {
    mockGetOutboxItems
      .mockResolvedValueOnce([{ id: 1 }]) // initial
      .mockResolvedValueOnce([])           // after sync
    mockProcessOutbox.mockResolvedValue(1)

    render(
      <SyncStatusProvider>
        <TestConsumer />
      </SyncStatusProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('pending').textContent).toBe('1')
    })

    await act(async () => {
      screen.getByTestId('sync').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('pending').textContent).toBe('0')
    })
    expect(mockProcessOutbox).toHaveBeenCalled()
  })

  it('does not sync when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })

    render(
      <SyncStatusProvider>
        <TestConsumer />
      </SyncStatusProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('online').textContent).toBe('false')
    })

    await act(async () => {
      screen.getByTestId('sync').click()
    })

    expect(mockProcessOutbox).not.toHaveBeenCalled()
  })

  it('does not sync when already syncing', async () => {
    let resolveProcess!: () => void
    mockProcessOutbox.mockImplementation(() => new Promise<number>(r => { resolveProcess = () => r(0) }))

    render(
      <SyncStatusProvider>
        <TestConsumer />
      </SyncStatusProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('syncing').textContent).toBe('false')
    })

    // Start first sync
    act(() => {
      screen.getByTestId('sync').click()
    })

    // Try second sync while first is in progress
    await act(async () => {
      screen.getByTestId('sync').click()
    })

    // Should only have been called once
    expect(mockProcessOutbox).toHaveBeenCalledTimes(1)

    // Resolve to clean up
    await act(async () => {
      resolveProcess()
    })
  })

  it('handles getOutboxItems error gracefully', async () => {
    mockGetOutboxItems.mockRejectedValue(new Error('IndexedDB unavailable'))

    render(
      <SyncStatusProvider>
        <TestConsumer />
      </SyncStatusProvider>
    )

    // Should not crash, pending stays at 0
    await waitFor(() => {
      expect(screen.getByTestId('pending').textContent).toBe('0')
    })
  })

  it('sets up interval for periodic sync', async () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval')

    render(
      <SyncStatusProvider>
        <TestConsumer />
      </SyncStatusProvider>
    )

    await waitFor(() => {
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000)
    })

    setIntervalSpy.mockRestore()
  })

  it('cleans up listeners and interval on unmount', async () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = render(
      <SyncStatusProvider>
        <TestConsumer />
      </SyncStatusProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('online').textContent).toBe('true')
    })

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))

    clearIntervalSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  it('useSyncStatus returns default context outside provider', () => {
    function Standalone() {
      const { isOnline, pendingCount } = useSyncStatus()
      return <span data-testid="standalone">{String(isOnline)}-{pendingCount}</span>
    }

    render(<Standalone />)
    expect(screen.getByTestId('standalone').textContent).toBe('true-0')
  })
})
