/**
 * Integration test: real IndexedDB (fake-indexeddb) → real db.ts → real sync-engine.ts → mocked Supabase client
 *
 * Only external boundary mocked:
 *   1. @/lib/supabase/client (Supabase browser client)
 *
 * The real db.ts and sync-engine.ts wire together naturally with fake-indexeddb.
 */

import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

// Stable supabase mock — reused across dynamic imports
const mockChain: Record<string, ReturnType<typeof vi.fn>> = {
  from: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  eq: vi.fn(),
}
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

beforeEach(() => {
  // Fresh IndexedDB per test for complete isolation
  globalThis.indexedDB = new IDBFactory()
  vi.resetModules()
  vi.clearAllMocks()

  // Restore default chain behavior after clearAllMocks
  mockChain.from.mockReturnValue(mockChain)
  mockChain.update.mockReturnValue(mockChain)
  mockChain.upsert.mockReturnValue(mockChain)
  mockChain.eq.mockReturnValue(mockChain)
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
})

describe('offline-sync-flow (integration)', () => {
  it('saveDraftLocally → addToOutbox(FINALIZE_SUBMIT) → processOutbox → supabase update with SUBMITTED', async () => {
    const { putDraft: saveDraftLocally, addToOutbox } = await import('@/lib/offline/db')
    const { processOutbox } = await import('@/lib/offline/sync-engine')

    await saveDraftLocally('slot-A', { walkCompletion: "COMPLETED", outcome: "NOT_SIGHTED" })
    await addToOutbox('FINALIZE_SUBMIT', { observationId: 'obs-1' }, 'draft-1')

    const processed = await processOutbox()

    expect(processed).toBe(1)
    expect(mockChain.from).toHaveBeenCalledWith('observations')
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SUBMITTED' }),
    )
    expect(mockChain.eq).toHaveBeenCalledWith('id', 'obs-1')
  })

  it('processOutbox with supabase error → incrementRetry → item still in outbox with retries=1', async () => {
    const { addToOutbox, getOutboxItems } = await import('@/lib/offline/db')
    const { processOutbox } = await import('@/lib/offline/sync-engine')

    await addToOutbox(
      'FINALIZE_SUBMIT',
      { observationId: 'obs-1' },
      'draft-1',
    )

    // Make from() throw to simulate network error
    mockChain.from.mockImplementation(() => {
      throw new Error('Network error')
    })

    const processed = await processOutbox()

    expect(processed).toBe(0)

    // Restore chain for reads (getOutboxItems uses IndexedDB, not supabase)
    const items = await getOutboxItems()
    expect(items).toHaveLength(1)
    expect(items[0].retries).toBe(1)
  })

  it('processOutbox skips items at MAX_RETRIES (5)', async () => {
    const { addToOutbox, getOutboxItems } = await import('@/lib/offline/db')
    const { processOutbox } = await import('@/lib/offline/sync-engine')

    // Add item then manually increment retries to 5
    await addToOutbox('FINALIZE_SUBMIT', { observationId: 'obs-1' }, 'draft-1')

    const items = await getOutboxItems()
    const { incrementRetry } = await import('@/lib/offline/db')
    for (let i = 0; i < 5; i++) {
      await incrementRetry(items[0].id!)
    }

    // Verify retries is 5
    const updatedItems = await getOutboxItems()
    expect(updatedItems[0].retries).toBe(5)

    const processed = await processOutbox()

    expect(processed).toBe(0)
    // Item is still in outbox, just skipped
    const remaining = await getOutboxItems()
    expect(remaining).toHaveLength(1)
  })

  it('cacheSet → cacheGet round trip with real TTL expiry', async () => {
    const { cacheSet, cacheGet } = await import('@/lib/offline/db')

    await cacheSet('routes', [{ id: 1, name: 'Route A' }], 1) // 1ms TTL
    await new Promise((r) => setTimeout(r, 10))

    const expired = await cacheGet('routes')
    expect(expired).toBeNull()

    // Non-expired value should be returned
    await cacheSet('routes', [{ id: 2, name: 'Route B' }], 60_000)
    const valid = await cacheGet('routes')
    expect(valid).toEqual([{ id: 2, name: 'Route B' }])
  })

  it('multiple outbox items → all processed and removed', async () => {
    const { addToOutbox, getOutboxItems } = await import('@/lib/offline/db')
    const { processOutbox } = await import('@/lib/offline/sync-engine')

    // UPLOAD_MEDIA with no matching media-queue entry → treated as already cleaned up
    await addToOutbox('UPLOAD_MEDIA', { mediaQueueId: 'missing-1' }, 'draft-1')
    await addToOutbox('UPLOAD_MEDIA', { mediaQueueId: 'missing-2' }, 'draft-2')
    await addToOutbox('UPLOAD_MEDIA', { mediaQueueId: 'missing-3' }, 'draft-3')

    const processed = await processOutbox()

    expect(processed).toBe(3)
    const remaining = await getOutboxItems()
    expect(remaining).toHaveLength(0)
  })

  it('full flow: saveDraftLocally + addToOutbox + processOutbox → outbox empty', async () => {
    const { putDraft: saveDraftLocally, addToOutbox, getOutboxItems, getDraft: getDraftByWalk } =
      await import('@/lib/offline/db')
    const { processOutbox } = await import('@/lib/offline/sync-engine')

    // Save draft locally
    await saveDraftLocally('slot-A', { walkCompletion: "COMPLETED", outcome: "NOT_SIGHTED", notes: 'macaque' })

    // Verify draft exists
    const draft = await getDraftByWalk('slot-A')
    expect(draft).toBeDefined()
    expect(draft!.data).toEqual({ walkCompletion: "COMPLETED", outcome: "NOT_SIGHTED", notes: 'macaque' })

    // Queue for sync
    await addToOutbox(
      'FINALIZE_SUBMIT',
      { observationId: 'obs-1' },
      'draft-1',
    )

    let items = await getOutboxItems()
    expect(items).toHaveLength(1)

    // Process
    const processed = await processOutbox()
    expect(processed).toBe(1)

    // Outbox should be empty
    items = await getOutboxItems()
    expect(items).toHaveLength(0)
  })

  it('addToOutbox(UPLOAD_MEDIA) with missing media-queue entry → removed from outbox', async () => {
    const { addToOutbox, getOutboxItems } = await import('@/lib/offline/db')
    const { processOutbox } = await import('@/lib/offline/sync-engine')

    await addToOutbox('UPLOAD_MEDIA', { mediaQueueId: 'nonexistent' }, 'draft-1')

    // Reset call counts so we can assert no supabase interactions
    mockChain.from.mockClear()

    const processed = await processOutbox()

    expect(processed).toBe(1)
    expect(mockChain.from).not.toHaveBeenCalled()

    const remaining = await getOutboxItems()
    expect(remaining).toHaveLength(0)
  })
})
