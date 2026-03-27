import {
  getOutboxItems,
  removeFromOutbox,
  incrementRetry,
  getQueuedMediaById,
  removeMediaFromQueue,
} from './db'
import { createClient } from '@/lib/supabase/client'

const MAX_RETRIES = 5

export async function processOutbox(): Promise<number> {
  const items = await getOutboxItems()
  if (items.length === 0) return 0

  const supabase = createClient()
  let processed = 0

  for (const item of items) {
    if (item.retries >= MAX_RETRIES) {
      continue
    }

    try {
      switch (item.action) {
        case 'UPLOAD_MEDIA': {
          const { mediaQueueId } = item.payload as { mediaQueueId: string }
          const queuedMedia = await getQueuedMediaById(mediaQueueId)
          if (!queuedMedia) {
            // Already cleaned up or missing — skip
            break
          }

          const parentId = queuedMedia.resolvedParentId || queuedMedia.clientParentId
          if (!parentId) {
            throw new Error('No parent ID for media upload')
          }

          const formData = new FormData()
          formData.append('file', queuedMedia.blob, queuedMedia.fileName)
          formData.append('parentType', queuedMedia.parentType)
          formData.append('parentId', parentId)
          if (queuedMedia.exifLat != null) formData.append('exifLat', String(queuedMedia.exifLat))
          if (queuedMedia.exifLng != null) formData.append('exifLng', String(queuedMedia.exifLng))
          if (queuedMedia.exifDatetime) formData.append('exifDatetime', queuedMedia.exifDatetime)

          const res = await fetch('/api/media', { method: 'POST', body: formData })
          const result = await res.json()

          if (!result.success) throw new Error(result.error || 'Media upload failed')

          await removeMediaFromQueue(mediaQueueId)
          break
        }

        case 'FINALIZE_SUBMIT': {
          const { observationId } = item.payload as { observationId: string }
          const { error: submitErr } = await supabase
            .from('observations')
            .update({
              status: 'SUBMITTED',
              submitted_at: new Date().toISOString(),
            })
            .eq('id', observationId)
          if (submitErr) throw new Error(`Submit failed: ${submitErr.message}`)
          break
        }
      }

      await removeFromOutbox(item.id!)
      processed++
    } catch (err) {
      console.error(`[sync-engine] Failed to process ${item.action} (id=${item.id}, retries=${item.retries}):`, err)
      await incrementRetry(item.id!)
    }
  }

  return processed
}
