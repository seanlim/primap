'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, X, Loader2, ImageOff } from 'lucide-react'
import { deleteMedia } from '@/lib/actions/observation-actions'
import { extractExifData } from '@/lib/utils/exif'
import { getSignedMediaUrl } from '@/lib/utils/storage'
import {
  saveMediaToQueue,
  getMediaByClientParent,
  removeMediaFromQueue,
  addToOutbox,
  cacheGet,
  cacheSet,
} from '@/lib/offline/db'
import { type QueuedMedia } from '@/lib/types/observation'

export interface MediaItem {
  id: string
  file_path: string
  file_name: string
  media_type: string
}

interface MediaUploaderProps {
  parentType: 'observation' | 'sighting'
  parentId: string | null
  existingMedia: MediaItem[]
  maxFiles?: number
  onExifGps?: (lat: number, lng: number) => void
  onExifDatetime?: (datetime: string) => void
  offline?: boolean
  clientParentId?: string
  syncKey?: number
}

export function MediaUploader({
  parentType,
  parentId,
  existingMedia,
  maxFiles = 10,
  onExifGps,
  onExifDatetime,
  offline = false,
  syncKey = 0,
  clientParentId,
}: MediaUploaderProps) {
  const [media, setMedia] = useState<MediaItem[]>(existingMedia)
  const [error, setError] = useState<string | null>(null)

  // Sync when parent updates existingMedia (e.g., after offline sync fetches server media)
  useEffect(() => {
    setMedia(existingMedia)
  }, [existingMedia])
  const [uploading, setUploading] = useState<Set<string>>(new Set())
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [localMedia, setLocalMedia] = useState<QueuedMedia[]>([])
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const blobUrlsRef = useRef<Record<string, string>>({})

  // Resolve URLs for server media: check IndexedDB blob cache first, then fetch + cache
  const mediaBlobUrlsRef = useRef<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

    async function resolveUrls() {
      const newUrls: Record<string, string> = {}
      for (const item of media) {
        if (signedUrls[item.id]) continue

        // Check IndexedDB blob cache first (works offline)
        const cacheKey = `media-blob:${item.file_path}`
        try {
          const cachedBlob = await cacheGet(cacheKey) as Blob | null
          if (cancelled) return
          if (cachedBlob && cachedBlob instanceof Blob) {
            const blobUrl = URL.createObjectURL(cachedBlob)
            mediaBlobUrlsRef.current[item.id] = blobUrl
            newUrls[item.id] = blobUrl
            continue
          }
        } catch {
          // Cache miss or error, fall through to network
        }

        // Skip network requests when offline — avoids timeout delays
        if (!navigator.onLine) {
          newUrls[item.id] = 'error'
          continue
        }

        // Network: get signed URL, fetch image, cache blob
        try {
          const signedUrl = await getSignedMediaUrl(item.file_path)
          if (cancelled) return
          newUrls[item.id] = signedUrl

          // Cache the image blob in background (don't block display)
          fetch(signedUrl, { mode: 'cors' }).then(async res => {
            if (res.ok) {
              const blob = await res.blob()
              await cacheSet(cacheKey, blob, SEVEN_DAYS)
            }
          }).catch(() => {})
        } catch {
          // Signed URL fetch failed — mark as error so we don't show infinite spinner
          newUrls[item.id] = 'error'
        }
      }
      if (Object.keys(newUrls).length > 0 && !cancelled) {
        setSignedUrls(prev => ({ ...prev, ...newUrls }))
      }
    }
    resolveUrls()
    return () => {
      cancelled = true
      // Revoke blob URLs created from cache
      Object.values(mediaBlobUrlsRef.current).forEach(URL.revokeObjectURL)
      mediaBlobUrlsRef.current = {}
    }
  }, [media]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load locally queued media from IndexedDB
  useEffect(() => {
    const effectiveParentId = clientParentId || parentId
    if (!effectiveParentId) return

    let cancelled = false
    async function loadLocalMedia() {
      try {
        const items = await getMediaByClientParent(effectiveParentId!)
        if (cancelled) return
        setLocalMedia(items)
        const urls: Record<string, string> = {}
        for (const item of items) {
          urls[item.id] = URL.createObjectURL(item.blob)
        }
        blobUrlsRef.current = urls
        setBlobUrls(urls)
      } catch {
        // IndexedDB might not be available
      }
    }
    loadLocalMedia()
    return () => {
      cancelled = true
      Object.values(blobUrlsRef.current).forEach(URL.revokeObjectURL)
    }
  }, [clientParentId, parentId, offline, syncKey])

  const totalMedia = media.length + localMedia.length

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const effectiveParentId = parentId || clientParentId
    if (!effectiveParentId) return

    const filesToUpload = Array.from(files).slice(0, maxFiles - totalMedia)
    if (filesToUpload.length === 0) return

    let gpsFired = false
    let datetimeFired = false

    for (const file of filesToUpload) {
      const tempId = crypto.randomUUID()

      try {
        // Extract EXIF (works offline)
        const exifData = await extractExifData(file)
        if (!gpsFired && exifData.lat && exifData.lng && onExifGps) {
          onExifGps(exifData.lat, exifData.lng)
          gpsFired = true
        }
        if (!datetimeFired && exifData.datetime && onExifDatetime) {
          onExifDatetime(exifData.datetime)
          datetimeFired = true
        }

        if (offline || !parentId) {
          // Offline path: save blob to IndexedDB
          const queuedItem: QueuedMedia = {
            id: tempId,
            clientParentId: effectiveParentId,
            parentType,
            resolvedParentId: parentId,
            blob: file,
            fileName: file.name,
            fileSize: file.size,
            mediaType: file.type.startsWith('video/') ? 'VIDEO' : 'PHOTO',
            exifLat: exifData.lat ?? null,
            exifLng: exifData.lng ?? null,
            exifDatetime: exifData.datetime ?? null,
            createdAt: Date.now(),
          }
          await saveMediaToQueue(queuedItem)
          await addToOutbox('UPLOAD_MEDIA', { mediaQueueId: tempId }, effectiveParentId)

          // Update local state for preview
          setLocalMedia(prev => [...prev, queuedItem])
          const blobUrl = URL.createObjectURL(file)
          blobUrlsRef.current[tempId] = blobUrl
          setBlobUrls(prev => ({ ...prev, [tempId]: blobUrl }))
        } else {
          // Online path: upload directly
          setUploading(prev => new Set(prev).add(tempId))

          const formData = new FormData()
          formData.append('file', file)
          formData.append('parentType', parentType)
          formData.append('parentId', parentId)
          if (exifData.lat != null) formData.append('exifLat', String(exifData.lat))
          if (exifData.lng != null) formData.append('exifLng', String(exifData.lng))
          if (exifData.datetime) formData.append('exifDatetime', exifData.datetime)

          try {
            const res = await fetch('/api/media', { method: 'POST', body: formData })
            const result = await res.json()

            if (res.status === 422) {
              // Server-side limit reached — show error, don't queue offline
              setError(result.error || 'Media limit reached')
              setTimeout(() => setError(null), 5000)
              break // Stop processing remaining files
            }

            if (result.success && result.media) {
              setMedia(prev => [...prev, result.media as MediaItem])
            } else {
              throw new Error(result.error || 'Upload failed')
            }
          } catch {
            // Online upload failed — fall back to offline queue
            const queuedItem: QueuedMedia = {
              id: tempId,
              clientParentId: effectiveParentId,
              parentType,
              resolvedParentId: parentId,
              blob: file,
              fileName: file.name,
              fileSize: file.size,
              mediaType: file.type.startsWith('video/') ? 'VIDEO' : 'PHOTO',
              exifLat: exifData.lat ?? null,
              exifLng: exifData.lng ?? null,
              exifDatetime: exifData.datetime ?? null,
              createdAt: Date.now(),
            }
            await saveMediaToQueue(queuedItem)
            await addToOutbox('UPLOAD_MEDIA', { mediaQueueId: tempId }, effectiveParentId)
            setLocalMedia(prev => [...prev, queuedItem])
            const blobUrl = URL.createObjectURL(file)
            blobUrlsRef.current[tempId] = blobUrl
            setBlobUrls(prev => ({ ...prev, [tempId]: blobUrl }))
          } finally {
            setUploading(prev => {
              const next = new Set(prev)
              next.delete(tempId)
              return next
            })
          }
        }
      } catch {
        // EXIF or queue failed silently
      }
    }

    // Reset input
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDelete = async (mediaId: string) => {
    const result = await deleteMedia(mediaId)
    if (result.success) {
      setMedia(prev => prev.filter(m => m.id !== mediaId))
      setSignedUrls(prev => {
        const next = { ...prev }
        delete next[mediaId]
        return next
      })
    }
  }

  const handleDeleteLocal = async (id: string) => {
    await removeMediaFromQueue(id)
    setLocalMedia(prev => prev.filter(m => m.id !== id))
    const url = blobUrlsRef.current[id]
    if (url) {
      URL.revokeObjectURL(url)
      delete blobUrlsRef.current[id]
      setBlobUrls(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }

  if (!parentId && !clientParentId) {
    return (
      <div className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-xl">
        Save draft to upload photos
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Preview grid */}
      {(totalMedia > 0 || uploading.size > 0) && (
        <div className="grid grid-cols-3 gap-2">
          {/* Server media */}
          {media.map(item => (
            <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
              {signedUrls[item.id] && signedUrls[item.id] !== 'error' ? (
                item.media_type === 'VIDEO' ? (
                  <video
                    src={signedUrls[item.id]}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={signedUrls[item.id]}
                    alt={item.file_name}
                    className="w-full h-full object-cover"
                  />
                )
              ) : signedUrls[item.id] === 'error' ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                  <ImageOff className="w-5 h-5 text-gray-300" />
                  <span className="text-[10px] text-gray-400">Unavailable</span>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
              )}
              {!offline && (
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {/* Locally queued media */}
          {localMedia.map(item => (
            <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
              {blobUrls[item.id] ? (
                item.mediaType === 'VIDEO' ? (
                  <video
                    src={blobUrls[item.id]}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={blobUrls[item.id]}
                    alt={item.fileName}
                    className="w-full h-full object-cover"
                  />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
              )}
              <span className="absolute bottom-1 left-1 bg-amber-500/80 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                Queued
              </span>
              <button
                type="button"
                onClick={() => handleDeleteLocal(item.id)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {/* Uploading spinners */}
          {Array.from(uploading).map(id => (
            <div key={id} className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Upload button — always shown (works both online and offline) */}
      {totalMedia < maxFiles && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2"
        >
          <Camera className="w-4 h-4" />
          {offline ? 'Add Photos/Videos (queued for upload)' : 'Add Photos/Videos'}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
