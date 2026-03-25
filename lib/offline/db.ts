import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

interface PrimapDB extends DBSchema {
  drafts: {
    key: string
    value: {
      id: string
      walkId: string
      data: Record<string, unknown>
      updatedAt: number
    }
    indexes: { 'by-walk': string }
  }
  outbox: {
    key: number
    value: {
      id?: number
      action: 'UPSERT_DRAFT' | 'UPLOAD_MEDIA' | 'FINALIZE_SUBMIT'
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
}

let dbPromise: Promise<IDBPDatabase<PrimapDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PrimapDB>('primap', 1, {
      upgrade(db) {
        const draftStore = db.createObjectStore('drafts', { keyPath: 'id' })
        draftStore.createIndex('by-walk', 'walkId')

        db.createObjectStore('outbox', {
          keyPath: 'id',
          autoIncrement: true,
        })

        db.createObjectStore('cache', { keyPath: 'key' })
      },
    })
  }
  return dbPromise
}

// Drafts
export async function saveDraftLocally(
  id: string,
  walkId: string,
  data: Record<string, unknown>
) {
  const db = await getDB()
  await db.put('drafts', { id, walkId, data, updatedAt: Date.now() })
}

export async function getDraftByWalk(walkId: string) {
  const db = await getDB()
  return db.getFromIndex('drafts', 'by-walk', walkId)
}

export async function deleteDraft(id: string) {
  const db = await getDB()
  await db.delete('drafts', id)
}

export async function getAllDrafts() {
  const db = await getDB()
  return db.getAll('drafts')
}

// Outbox
export async function addToOutbox(
  action: 'UPSERT_DRAFT' | 'UPLOAD_MEDIA' | 'FINALIZE_SUBMIT',
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
