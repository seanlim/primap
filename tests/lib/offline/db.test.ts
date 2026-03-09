import { describe, it, expect, vi, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

beforeEach(() => {
  // Replace global indexedDB with a fresh instance for complete isolation
  globalThis.indexedDB = new IDBFactory()
  vi.resetModules()
})

describe('Drafts', () => {
  it('saveDraftLocally + getDraftBySlot round trip', async () => {
    const { saveDraftLocally, getDraftBySlot } = await import('@/lib/offline/db')

    await saveDraftLocally('draft-1', 'slot-A', { species: 'macaque' })
    const result = await getDraftBySlot('slot-A')

    expect(result).toBeDefined()
    expect(result!.id).toBe('draft-1')
    expect(result!.slotId).toBe('slot-A')
    expect(result!.data).toEqual({ species: 'macaque' })
    expect(result!.updatedAt).toBeTypeOf('number')
  })

  it('saveDraftLocally overwrites existing with same id', async () => {
    const { saveDraftLocally, getDraftBySlot } = await import('@/lib/offline/db')

    await saveDraftLocally('draft-1', 'slot-A', { species: 'macaque' })
    await saveDraftLocally('draft-1', 'slot-A', { species: 'gibbon' })

    const result = await getDraftBySlot('slot-A')
    expect(result!.data).toEqual({ species: 'gibbon' })
  })

  it('getDraftBySlot returns undefined for missing slot', async () => {
    const { getDraftBySlot } = await import('@/lib/offline/db')

    const result = await getDraftBySlot('nonexistent-slot')
    expect(result).toBeUndefined()
  })

  it('deleteDraft removes draft', async () => {
    const { saveDraftLocally, getDraftBySlot, deleteDraft } = await import('@/lib/offline/db')

    await saveDraftLocally('draft-1', 'slot-A', { species: 'macaque' })
    await deleteDraft('draft-1')

    const result = await getDraftBySlot('slot-A')
    expect(result).toBeUndefined()
  })

  it('getAllDrafts returns all saved drafts', async () => {
    const { saveDraftLocally, getAllDrafts } = await import('@/lib/offline/db')

    await saveDraftLocally('draft-1', 'slot-A', { species: 'macaque' })
    await saveDraftLocally('draft-2', 'slot-B', { species: 'gibbon' })
    await saveDraftLocally('draft-3', 'slot-C', { species: 'langur' })

    const drafts = await getAllDrafts()
    expect(drafts).toHaveLength(3)
    expect(drafts.map((d) => d.id).sort()).toEqual(['draft-1', 'draft-2', 'draft-3'])
  })

  it('getAllDrafts returns empty array when none', async () => {
    const { getAllDrafts } = await import('@/lib/offline/db')

    const drafts = await getAllDrafts()
    expect(drafts).toEqual([])
  })
})

describe('Outbox', () => {
  it('addToOutbox + getOutboxItems round trip', async () => {
    const { addToOutbox, getOutboxItems } = await import('@/lib/offline/db')

    await addToOutbox('UPSERT_DRAFT', { slotId: 'slot-A' }, 'client-1')
    const items = await getOutboxItems()

    expect(items).toHaveLength(1)
    expect(items[0].action).toBe('UPSERT_DRAFT')
    expect(items[0].payload).toEqual({ slotId: 'slot-A' })
    expect(items[0].clientDraftId).toBe('client-1')
  })

  it('addToOutbox sets retries to 0 and createdAt', async () => {
    const { addToOutbox, getOutboxItems } = await import('@/lib/offline/db')

    const before = Date.now()
    await addToOutbox('UPLOAD_MEDIA', { file: 'photo.jpg' }, 'client-2')
    const after = Date.now()

    const items = await getOutboxItems()
    expect(items[0].retries).toBe(0)
    expect(items[0].createdAt).toBeGreaterThanOrEqual(before)
    expect(items[0].createdAt).toBeLessThanOrEqual(after)
  })

  it('removeFromOutbox removes item', async () => {
    const { addToOutbox, getOutboxItems, removeFromOutbox } = await import('@/lib/offline/db')

    await addToOutbox('UPSERT_DRAFT', { slotId: 'slot-A' }, 'client-1')
    const items = await getOutboxItems()
    expect(items).toHaveLength(1)

    await removeFromOutbox(items[0].id!)
    const remaining = await getOutboxItems()
    expect(remaining).toHaveLength(0)
  })

  it('incrementRetry increments retries field', async () => {
    const { addToOutbox, getOutboxItems, incrementRetry } = await import('@/lib/offline/db')

    await addToOutbox('FINALIZE_SUBMIT', { observationId: 'obs-1' }, 'client-3')
    const items = await getOutboxItems()
    expect(items[0].retries).toBe(0)

    await incrementRetry(items[0].id!)
    const updated = await getOutboxItems()
    expect(updated[0].retries).toBe(1)

    await incrementRetry(items[0].id!)
    const updatedAgain = await getOutboxItems()
    expect(updatedAgain[0].retries).toBe(2)
  })

  it('incrementRetry on non-existent id is no-op', async () => {
    const { incrementRetry } = await import('@/lib/offline/db')

    // Should not throw
    await expect(incrementRetry(99999)).resolves.toBeUndefined()
  })
})

describe('Cache', () => {
  it('cacheSet + cacheGet round trip', async () => {
    const { cacheSet, cacheGet } = await import('@/lib/offline/db')

    await cacheSet('routes', [{ id: 1, name: 'Route A' }])
    const result = await cacheGet('routes')

    expect(result).toEqual([{ id: 1, name: 'Route A' }])
  })

  it('cacheGet returns null for missing key', async () => {
    const { cacheGet } = await import('@/lib/offline/db')

    const result = await cacheGet('nonexistent')
    expect(result).toBeNull()
  })

  it('cacheGet returns null and deletes expired item', async () => {
    const { cacheSet, cacheGet } = await import('@/lib/offline/db')

    // Use a TTL of 1ms then wait a bit to guarantee expiration
    await cacheSet('ephemeral', 'data', 1)
    await new Promise((r) => setTimeout(r, 10))

    const result = await cacheGet('ephemeral')
    expect(result).toBeNull()

    // Verify it was deleted — a second get should also return null
    const second = await cacheGet('ephemeral')
    expect(second).toBeNull()
  })

  it('cacheSet with custom TTL', async () => {
    const { cacheSet, cacheGet } = await import('@/lib/offline/db')

    // Set with a very long TTL
    await cacheSet('long-lived', { value: 42 }, 60 * 60 * 1000)
    const result = await cacheGet('long-lived')
    expect(result).toEqual({ value: 42 })
  })

  it('cacheSet overwrites existing key', async () => {
    const { cacheSet, cacheGet } = await import('@/lib/offline/db')

    await cacheSet('key', 'first')
    await cacheSet('key', 'second')

    const result = await cacheGet('key')
    expect(result).toBe('second')
  })
})
