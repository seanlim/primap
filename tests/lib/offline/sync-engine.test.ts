import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOutboxItems, removeFromOutbox, incrementRetry } from '@/lib/offline/db'

vi.mock('@/lib/offline/db', () => ({
  getOutboxItems: vi.fn(),
  removeFromOutbox: vi.fn(),
  incrementRetry: vi.fn(),
}))

const mockGetOutboxItems = vi.mocked(getOutboxItems)
const mockRemoveFromOutbox = vi.mocked(removeFromOutbox)
const mockIncrementRetry = vi.mocked(incrementRetry)

// Stable supabase mock — the chain object is reused across createClient calls
// so tests can configure it before processOutbox runs.
const mockChain: Record<string, ReturnType<typeof vi.fn>> = {
  eq: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  from: vi.fn(),
}
// Wire up default chaining: from -> update/upsert -> eq -> chain
mockChain.from.mockReturnValue(mockChain)
mockChain.update.mockReturnValue(mockChain)
mockChain.upsert.mockReturnValue(mockChain)
mockChain.eq.mockReturnValue(mockChain)

const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: mockChain.from,
    auth: { getUser: mockGetUser },
  })),
}))

function makeOutboxItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    action: 'UPSERT_DRAFT' as const,
    payload: { walkId: 'slot-A' },
    clientDraftId: 'client-1',
    createdAt: Date.now(),
    retries: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Restore default chain behavior after clearAllMocks wipes mockReturnValue
  mockChain.from.mockReturnValue(mockChain)
  mockChain.update.mockReturnValue(mockChain)
  mockChain.upsert.mockReturnValue(mockChain)
  mockChain.eq.mockReturnValue(mockChain)
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
})

describe('processOutbox', () => {
  it('empty outbox returns 0', async () => {
    mockGetOutboxItems.mockResolvedValue([])

    const { processOutbox } = await import('@/lib/offline/sync-engine')
    const result = await processOutbox()

    expect(result).toBe(0)
    expect(mockRemoveFromOutbox).not.toHaveBeenCalled()
  })

  it('skips items with retries >= 5 (MAX_RETRIES)', async () => {
    mockGetOutboxItems.mockResolvedValue([
      makeOutboxItem({ id: 1, retries: 5 }),
      makeOutboxItem({ id: 2, retries: 10 }),
    ])

    const { processOutbox } = await import('@/lib/offline/sync-engine')
    const result = await processOutbox()

    expect(result).toBe(0)
    expect(mockRemoveFromOutbox).not.toHaveBeenCalled()
  })

  it('UPSERT_DRAFT with observationId calls update().eq()', async () => {
    mockGetOutboxItems.mockResolvedValue([
      makeOutboxItem({
        id: 1,
        payload: { walkId: 'slot-A', observationId: 'obs-1', species: 'macaque' },
      }),
    ])

    const { processOutbox } = await import('@/lib/offline/sync-engine')
    await processOutbox()

    expect(mockChain.from).toHaveBeenCalledWith('observations')
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ species: 'macaque' })
    )
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'obs-1')
    expect(mockRemoveFromOutbox).toHaveBeenCalledWith(1)
  })

  it('UPSERT_DRAFT without observationId calls auth.getUser() then upsert()', async () => {
    mockGetOutboxItems.mockResolvedValue([
      makeOutboxItem({
        id: 1,
        payload: { walkId: 'slot-A', species: 'gibbon' },
        clientDraftId: 'client-1',
      }),
    ])

    const { processOutbox } = await import('@/lib/offline/sync-engine')
    await processOutbox()

    expect(mockGetUser).toHaveBeenCalled()
    expect(mockChain.from).toHaveBeenCalledWith('observations')
    expect(mockChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        slot_id: 'slot-A',
        user_id: 'user-123',
        client_draft_id: 'client-1',
        species: 'gibbon',
      }),
      { onConflict: 'slot_id,user_id' }
    )
    expect(mockRemoveFromOutbox).toHaveBeenCalledWith(1)
  })

  it('UPSERT_DRAFT without observationId, user is null -> incrementRetry called', async () => {
    mockGetOutboxItems.mockResolvedValue([
      makeOutboxItem({
        id: 1,
        payload: { walkId: 'slot-A' },
      }),
    ])
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { processOutbox } = await import('@/lib/offline/sync-engine')
    const result = await processOutbox()

    expect(result).toBe(0)
    expect(mockIncrementRetry).toHaveBeenCalledWith(1)
    expect(mockRemoveFromOutbox).not.toHaveBeenCalled()
  })

  it('UPLOAD_MEDIA is no-op, still removes from outbox', async () => {
    mockGetOutboxItems.mockResolvedValue([
      makeOutboxItem({ id: 1, action: 'UPLOAD_MEDIA', payload: { file: 'photo.jpg' } }),
    ])

    const { processOutbox } = await import('@/lib/offline/sync-engine')
    const result = await processOutbox()

    expect(result).toBe(1)
    expect(mockRemoveFromOutbox).toHaveBeenCalledWith(1)
  })

  it('FINALIZE_SUBMIT updates status to SUBMITTED', async () => {
    mockGetOutboxItems.mockResolvedValue([
      makeOutboxItem({ id: 1, action: 'FINALIZE_SUBMIT', payload: { observationId: 'obs-1' } }),
    ])

    const { processOutbox } = await import('@/lib/offline/sync-engine')
    await processOutbox()

    expect(mockChain.from).toHaveBeenCalledWith('observations')
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SUBMITTED' })
    )
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'obs-1')
    expect(mockRemoveFromOutbox).toHaveBeenCalledWith(1)
  })

  it('error during processing calls incrementRetry', async () => {
    mockGetOutboxItems.mockResolvedValue([
      makeOutboxItem({
        id: 1,
        action: 'FINALIZE_SUBMIT',
        payload: { observationId: 'obs-1' },
      }),
    ])
    // Make from() throw to simulate a network error
    mockChain.from.mockImplementation(() => {
      throw new Error('Network error')
    })

    const { processOutbox } = await import('@/lib/offline/sync-engine')
    const result = await processOutbox()

    expect(result).toBe(0)
    expect(mockIncrementRetry).toHaveBeenCalledWith(1)
    expect(mockRemoveFromOutbox).not.toHaveBeenCalled()
  })

  it('returns correct processed count', async () => {
    mockGetOutboxItems.mockResolvedValue([
      makeOutboxItem({ id: 1, action: 'UPLOAD_MEDIA', payload: {} }),
      makeOutboxItem({ id: 2, retries: 5, action: 'UPLOAD_MEDIA', payload: {} }), // skipped
      makeOutboxItem({ id: 3, action: 'UPLOAD_MEDIA', payload: {} }),
    ])

    const { processOutbox } = await import('@/lib/offline/sync-engine')
    const result = await processOutbox()

    expect(result).toBe(2)
  })

  it('multiple items processed - all removed from outbox', async () => {
    mockGetOutboxItems.mockResolvedValue([
      makeOutboxItem({ id: 1, action: 'UPLOAD_MEDIA', payload: {} }),
      makeOutboxItem({ id: 2, action: 'UPLOAD_MEDIA', payload: {} }),
      makeOutboxItem({ id: 3, action: 'UPLOAD_MEDIA', payload: {} }),
    ])

    const { processOutbox } = await import('@/lib/offline/sync-engine')
    const result = await processOutbox()

    expect(result).toBe(3)
    expect(mockRemoveFromOutbox).toHaveBeenCalledTimes(3)
    expect(mockRemoveFromOutbox).toHaveBeenCalledWith(1)
    expect(mockRemoveFromOutbox).toHaveBeenCalledWith(2)
    expect(mockRemoveFromOutbox).toHaveBeenCalledWith(3)
  })
})
