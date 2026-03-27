import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { type OfflineDraftInput, type QueuedMedia } from '@/lib/types/observation'

interface PrimapDB extends DBSchema {
  drafts: {
    key: string
    value: {
      walkId: string
      data: OfflineDraftInput
      lastModified: number
      serverUpdatedAt: string | null
    }
  }
  outbox: {
    key: number
    value: {
      id?: number
      action: 'UPLOAD_MEDIA' | 'FINALIZE_SUBMIT'
      payload: Record<string, unknown>
      clientDraftId: string
      createdAt: number
      retries: number
    }
  }
  cache: {
    key: string
    value: {
      key: string
      data: unknown
      expiresAt: number
    }
  }
  'media-queue': {
    key: string
    value: QueuedMedia
    indexes: { 'by-client-parent': string }
  }
}

let dbPromise: Promise<IDBPDatabase<PrimapDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PrimapDB>('primap', 3, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('drafts', { keyPath: 'walkId' })
          db.createObjectStore('outbox', {
            keyPath: 'id',
            autoIncrement: true,
          })
          db.createObjectStore('cache', { keyPath: 'key' })
        }
        if (oldVersion < 2) {
          const mqStore = db.createObjectStore('media-queue', { keyPath: 'id' })
          mqStore.createIndex('by-client-parent', 'clientParentId')
        }
        // v3: draft schema adds lastModified + serverUpdatedAt (no store change needed,
        // just read/write code). Existing drafts with updatedAt are handled via backward compat.
      },
    })
  }
  return dbPromise
}

// Drafts
export async function putDraft(
  walkId: string,
  data: OfflineDraftInput,
  serverUpdatedAt?: string | null
) {
  const db = await getDB()
  await db.put('drafts', {
    walkId,
    data,
    lastModified: Date.now(),
    serverUpdatedAt: serverUpdatedAt ?? null,
  })
}

export async function getDraft(walkId: string) {
  const db = await getDB()
  const draft = await db.get('drafts', walkId)
  if (!draft) return null
  // Backward compat: old drafts may have updatedAt instead of lastModified
  if (!draft.lastModified && (draft as Record<string, unknown>).updatedAt) {
    draft.lastModified = (draft as Record<string, unknown>).updatedAt as number
  }
  if (draft.serverUpdatedAt === undefined) {
    draft.serverUpdatedAt = null
  }
  return draft
}

export async function deleteDraft(walkId: string) {
  const db = await getDB()
  await db.delete('drafts', walkId)
}

export async function getAllDrafts() {
  const db = await getDB()
  return db.getAll('drafts')
}

// Outbox
export async function addToOutbox(
  action: 'UPLOAD_MEDIA' | 'FINALIZE_SUBMIT',
  payload: Record<string, unknown>,
  clientDraftId: string
) {
  const db = await getDB()
  await db.add('outbox', {
    action,
    payload,
    clientDraftId,
    createdAt: Date.now(),
    retries: 0,
  })
}

export async function getOutboxItems() {
  const db = await getDB()
  return db.getAll('outbox')
}

export async function removeFromOutbox(id: number) {
  const db = await getDB()
  await db.delete('outbox', id)
}

export async function incrementRetry(id: number) {
  const db = await getDB()
  const item = await db.get('outbox', id)
  if (item) {
    item.retries += 1
    await db.put('outbox', item)
  }
}

// Media Queue
export async function saveMediaToQueue(item: QueuedMedia) {
  const db = await getDB()
  await db.put('media-queue', item)
}

export async function getMediaByClientParent(clientParentId: string) {
  const db = await getDB()
  return db.getAllFromIndex('media-queue', 'by-client-parent', clientParentId)
}

export async function getQueuedMediaById(id: string) {
  const db = await getDB()
  return db.get('media-queue', id)
}

export async function getAllQueuedMedia() {
  const db = await getDB()
  return db.getAll('media-queue')
}

export async function removeMediaFromQueue(id: string) {
  const db = await getDB()
  await db.delete('media-queue', id)
}

export async function updateMediaResolvedParentId(id: string, resolvedParentId: string) {
  const db = await getDB()
  const item = await db.get('media-queue', id)
  if (item) {
    item.resolvedParentId = resolvedParentId
    await db.put('media-queue', item)
  }
}

// Scoped cleanup: clears outbox + media-queue for a specific walk, NOT the draft
export async function clearSyncStateForWalk(walkId: string) {
  const db = await getDB()

  // Enumerate all clientParentIds from the draft's sightings
  const draft = await db.get('drafts', walkId)
  const parentIds = new Set<string>()
  if (draft) {
    if (draft.data.observationId) parentIds.add(draft.data.observationId)
    if (draft.data.clientDraftId) parentIds.add(draft.data.clientDraftId)
    for (const s of (draft.data.sightings ?? [])) {
      if (s.clientTempId) parentIds.add(s.clientTempId)
      if (s.id) parentIds.add(s.id)
    }
  }
  // Also add walkId itself as a fallback
  parentIds.add(walkId)

  // Delete matching outbox items
  const outboxItems = await db.getAll('outbox')
  for (const item of outboxItems) {
    if (parentIds.has(item.clientDraftId)) {
      await db.delete('outbox', item.id!)
    }
  }

  // Delete matching media-queue items
  for (const pid of parentIds) {
    const mediaItems = await db.getAllFromIndex('media-queue', 'by-client-parent', pid)
    for (const item of mediaItems) {
      await db.delete('media-queue', item.id)
    }
  }
}

// Cache
export async function cacheSet(key: string, data: unknown, ttlMs: number = 5 * 60 * 1000) {
  const db = await getDB()
  await db.put('cache', { key, data, expiresAt: Date.now() + ttlMs })
}

export async function cacheGet(key: string) {
  const db = await getDB()
  const item = await db.get('cache', key)
  if (!item) return null
  if (item.expiresAt < Date.now()) {
    await db.delete('cache', key)
    return null
  }
  return item.data
}
