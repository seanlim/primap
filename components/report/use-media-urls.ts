'use client'

import { useEffect, useState } from 'react'
import { getSignedMediaUrl, OBSERVATION_MEDIA_BUCKET, type MediaBucket } from '@/lib/utils/storage'
import { cacheGet, cacheSet } from '@/lib/offline/db'

interface MediaItemLike {
  id: string
  file_path: string
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Resolves signed/cached URLs for a list of media items.
 *
 * Resolution order:
 *   1. IndexedDB blob cache (works offline; preferred for speed)
 *   2. Signed URL from Supabase storage (network)
 *
 * Returns a `signedUrls` map keyed by media id. Values are either:
 *   - a real URL (https or blob:),
 *   - the literal string `'error'` to indicate resolution failed.
 *
 * Cleanup is race-safe: blob URLs created during a given effect run are
 * tracked in a local array and revoked exactly once on unmount or when the
 * media list changes — even if the async resolution is still in flight.
 */
export function useMediaUrls(media: MediaItemLike[], bucket: MediaBucket = OBSERVATION_MEDIA_BUCKET) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (media.length === 0) return

    let cancelled = false
    // Track blob URLs created INSIDE this specific effect run so cleanup can
    // revoke them deterministically. Avoids the cross-run leak where a stale
    // ref-based array misses URLs created post-snapshot.
    const createdBlobs: string[] = []

    async function resolveUrls() {
      const urls: Record<string, string> = {}

      for (const item of media) {
        if (cancelled) return

        // 1. Check IndexedDB blob cache (works offline)
        const cacheKey = `media-blob:${item.file_path}`
        try {
          const cachedBlob = (await cacheGet(cacheKey)) as Blob | null
          if (cancelled) return
          if (cachedBlob && cachedBlob instanceof Blob) {
            const blobUrl = URL.createObjectURL(cachedBlob)
            createdBlobs.push(blobUrl)
            urls[item.id] = blobUrl
            continue
          }
        } catch {
          // cache miss — fall through to network
        }

        // 2. Skip network when offline — surfaces an error tile instead
        // of leaving a perpetual loading spinner.
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          urls[item.id] = 'error'
          continue
        }

        // 3. Network: get signed URL, cache the blob in background
        try {
          const signedUrl = await getSignedMediaUrl(item.file_path, bucket)
          if (cancelled) return
          urls[item.id] = signedUrl

          // Background fetch + cache (don't block render)
          fetch(signedUrl, { mode: 'cors' })
            .then(async res => {
              if (res.ok) {
                const blob = await res.blob()
                await cacheSet(cacheKey, blob, SEVEN_DAYS_MS)
              }
            })
            .catch(() => {})
        } catch {
          urls[item.id] = 'error'
        }
      }

      if (!cancelled) setSignedUrls(prev => ({ ...prev, ...urls }))
    }

    resolveUrls()

    return () => {
      cancelled = true
      createdBlobs.forEach(URL.revokeObjectURL)
    }
  }, [media, bucket])

  return signedUrls
}
