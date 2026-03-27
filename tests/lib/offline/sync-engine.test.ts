import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOutboxItems, removeFromOutbox, incrementRetry, getQueuedMediaById, removeMediaFromQueue } from '@/lib/offline/db'

vi.mock('@/lib/offline/db', () => ({
  getOutboxItems: vi.fn(),
  removeFromOutbox: vi.fn(),
  incrementRetry: vi.fn(),
  getQueuedMediaById: vi.fn(),
  removeMediaFromQueue: vi.fn(),
}))

const mockGetOutboxItems = vi.mocked(getOutboxItems)
const mockRemoveFromOutbox = vi.mocked(removeFromOutbox)
const mockIncrementRetry = vi.mocked(incrementRetry)
const mockGetQueuedMediaById = vi.mocked(getQueuedMediaById)
const mockRemoveMediaFromQueue = vi.mocked(removeMediaFromQueue)

const mockChain: Record<string, ReturnType<typeof vi.fn>> = {
  eq: vi.fn(),
  update: vi.fn(),
  from: vi.fn(),
}
mockChain.from.mockReturnValue(mockChain)
mockChain.update.mockReturnValue(mockChain)
mockChain.eq.mockReturnValue(mockChain)

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: mockChain.from,
  })),
}))

function makeOutboxItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    action: 'UPLOAD_MEDIA' as const,
    payload: { mediaQueueId: 'mq-1' },
    clientDraftId: 'client-1',
    createdAt: Date.now(),
    retries: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockChain.from.mockReturnValue(mockChain)
  mockChain.update.mockReturnValue(mockChain)
  mockChain.eq.mockReturnValue(mockChain)
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

  it('UPLOAD_MEDIA with missing media-queue entry skips and removes from outbox', async () => {
    mockGetQueuedMediaById.mockResolvedValue(undefined)
    mockGetOutboxItems.mockResolvedValue([
      makeOutboxItem({ id: 1, action: 'UPLOAD_MEDIA', payload: { mediaQueueId: 'nonexistent' } }),
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
    mockChain.from.mockImplementation(() => {
      throw new Error('Network error')
    })

    const { processOutbox } = await import('@/lib/offline/sync-engine')
    const result = await processOutbox()

    expect(result).toBe(0)
    expect(mockIncrementRetry).toHaveBeenCalledWith(1)
    expect(mockRemoveFromOutbox).not.toHaveBeenCalled()
  })

  it('returns correct processed count (skips maxed retries)', async () => {
    mockGetQueuedMediaById.mockResolvedValue(undefined)
    mockGetOutboxItems.mockResolvedValue([
      makeOutboxItem({ id: 1, action: 'UPLOAD_MEDIA', payload: { mediaQueueId: 'a' } }),
      makeOutboxItem({ id: 2, retries: 5, action: 'UPLOAD_MEDIA', payload: { mediaQueueId: 'b' } }),
      makeOutboxItem({ id: 3, action: 'UPLOAD_MEDIA', payload: { mediaQueueId: 'c' } }),
    ])

    const { processOutbox } = await import('@/lib/offline/sync-engine')
    const result = await processOutbox()

    expect(result).toBe(2)
  })

  it('multiple items processed - all removed from outbox', async () => {
    mockGetQueuedMediaById.mockResolvedValue(undefined)
    mockGetOutboxItems.mockResolvedValue([
      makeOutboxItem({ id: 1, action: 'UPLOAD_MEDIA', payload: { mediaQueueId: 'a' } }),
      makeOutboxItem({ id: 2, action: 'UPLOAD_MEDIA', payload: { mediaQueueId: 'b' } }),
      makeOutboxItem({ id: 3, action: 'UPLOAD_MEDIA', payload: { mediaQueueId: 'c' } }),
    ])

    const { processOutbox } = await import('@/lib/offline/sync-engine')
    const result = await processOutbox()

    expect(result).toBe(3)
    expect(mockRemoveFromOutbox).toHaveBeenCalledTimes(3)
  })

  it('UPLOAD_MEDIA with resolvedParentId uses it over clientParentId', async () => {
    const blob = new Blob(['img'], { type: 'image/png' })
    mockGetQueuedMediaById.mockResolvedValue({
      id: 'mq-obs',
      clientParentId: 'local-uuid-123',
      parentType: 'observation',
      resolvedParentId: 'real-obs-id-456',
      blob,
      fileName: 'photo.png',
      fileSize: 3,
      mediaType: 'PHOTO',
      exifLat: null,
      exifLng: null,
      exifDatetime: null,
      createdAt: Date.now(),
    })
    mockGetOutboxItems.mockResolvedValue([
      makeOutboxItem({ id: 1, action: 'UPLOAD_MEDIA', payload: { mediaQueueId: 'mq-obs' } }),
    ])

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    )

    const { processOutbox } = await import('@/lib/offline/sync-engine')
    const result = await processOutbox()

    expect(result).toBe(1)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('/api/media')
    const body = init?.body as FormData
    expect(body.get('parentId')).toBe('real-obs-id-456')
    expect(body.get('parentType')).toBe('observation')
    expect(mockRemoveMediaFromQueue).toHaveBeenCalledWith('mq-obs')
    expect(mockRemoveFromOutbox).toHaveBeenCalledWith(1)

    fetchSpy.mockRestore()
  })

  it('UPLOAD_MEDIA falls back to clientParentId when resolvedParentId is null', async () => {
    const blob = new Blob(['img'], { type: 'image/png' })
    mockGetQueuedMediaById.mockResolvedValue({
      id: 'mq-fallback',
      clientParentId: 'local-uuid-789',
      parentType: 'observation',
      resolvedParentId: null,
      blob,
      fileName: 'photo.png',
      fileSize: 3,
      mediaType: 'PHOTO',
      exifLat: null,
      exifLng: null,
      exifDatetime: null,
      createdAt: Date.now(),
    })
    mockGetOutboxItems.mockResolvedValue([
      makeOutboxItem({ id: 1, action: 'UPLOAD_MEDIA', payload: { mediaQueueId: 'mq-fallback' } }),
    ])

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    )

    const { processOutbox } = await import('@/lib/offline/sync-engine')
    const result = await processOutbox()

    expect(result).toBe(1)
    const body = (fetchSpy.mock.calls[0][1]?.body) as FormData
    expect(body.get('parentId')).toBe('local-uuid-789')

    fetchSpy.mockRestore()
  })
})
