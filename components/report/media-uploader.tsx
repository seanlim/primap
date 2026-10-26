'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, X, Loader2, ImageOff } from 'lucide-react'
import { deleteMedia } from '@/lib/actions/observation-actions'
import { extractExifData } from '@/lib/utils/exif'
import {
  OBSERVATION_MEDIA_BUCKET,
  INCIDENT_MEDIA_BUCKET,
  type MediaBucket,
} from '@/lib/utils/storage'
import {
  saveMediaToQueue,
  getMediaByClientParent,
  removeMediaFromQueue,
  addToOutbox,
} from '@/lib/offline/db'
import { type QueuedMedia } from '@/lib/types/observation'
import { useMediaUrls } from './use-media-urls'
import { useReportMediaBudget } from './report-media-budget'
import { SUPPORTED_MEDIA_TYPES, UNSUPPORTED_MEDIA_MESSAGE, isSupportedMediaType } from '@/lib/constants/media'

export interface MediaItem {
  id: string
  file_path: string
  file_name: string
  media_type: string
}

interface MediaUploaderProps {
  parentType: 'observation' | 'sighting' | 'incident'
  parentId: string | null
  existingMedia: MediaItem[]
  maxFiles?: number
  label?: string
  onExifGps?: (lat: number, lng: number) => void
  onExifDatetime?: (datetime: string) => void
  offline?: boolean
  clientParentId?: string
  syncKey?: number
  /**
   * Fired whenever the in-flight upload count changes. Useful for parents
   * that need to block navigation/dismissal while files are still uploading
   * (e.g., the IncidentModal phase 2 step).
   * The instance ID distinguishes overlapping uploads after an uploader remounts.
   */
  onUploadingChange?: (uploadingCount: number, uploaderId: string) => void
  /**
   * Custom delete handler. If provided, called instead of the default
   * `deleteMedia` action. Used by admin edit to bypass RLS via service role.
   */
  onDeleteMedia?: (mediaId: string) => Promise<{ success?: true; error?: string }>
  /**
   * When true, hides the upload button and file input. Existing media is
   * displayed (and deletable if not offline) but no new files can be added.
   * Used by admin edit where uploads go through a different auth path.
   */
  onMediaChange?: (media: MediaItem[]) => void
  readOnly?: boolean
}

export function MediaUploader({
  parentType,
  parentId,
  existingMedia,
  maxFiles = 10,
  label,
  onExifGps,
  onExifDatetime,
  offline = false,
  syncKey = 0,
  clientParentId,
  onUploadingChange,
  onDeleteMedia,
  readOnly = false,
  onMediaChange,
}: MediaUploaderProps) {
  // Pick the storage bucket based on parent type. Incidents live in
  // INCIDENT_MEDIA_BUCKET; observations and sightings share OBSERVATION_MEDIA_BUCKET.
  const bucket: MediaBucket = parentType === 'incident' ? INCIDENT_MEDIA_BUCKET : OBSERVATION_MEDIA_BUCKET
  const [media, setMedia] = useState<MediaItem[]>(existingMedia)
  const [error, setError] = useState<string | null>(null)

  // Sync when parent updates existingMedia (e.g., after offline sync fetches server media)
  useEffect(() => {
    setMedia(existingMedia)
  }, [existingMedia])
  const [uploading, setUploading] = useState<Set<string>>(new Set())
  const [uploaderId] = useState(() => crypto.randomUUID())
  const uploadingCountRef = useRef(0)
  const onUploadingChangeRef = useRef(onUploadingChange)
  onUploadingChangeRef.current = onUploadingChange
  const [localMediaLoaded, setLocalMediaLoaded] = useState(false)
  const budget = useReportMediaBudget()
  const budgetKey = parentType === 'observation' ? 'observation' : (clientParentId || parentId || '')
  const onMediaChangeRef = useRef(onMediaChange)
  onMediaChangeRef.current = onMediaChange
  useEffect(() => { onMediaChangeRef.current?.(media) }, [media])
  const [localMedia, setLocalMedia] = useState<QueuedMedia[]>([])
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const blobUrlsRef = useRef<Record<string, string>>({})

  // Resolve URLs for server media via the shared hook (cache → signed URL,
  // race-safe blob cleanup, offline-aware).
  const signedUrls = useMediaUrls(media, bucket)

  // Requests can outlive an uploader hidden or removed from the report form.
  const updateUploadingCount = (delta: number) => {
    uploadingCountRef.current += delta
    onUploadingChangeRef.current?.(uploadingCountRef.current, uploaderId)
  }

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
        setLocalMediaLoaded(true)
        const urls: Record<string, string> = {}
        for (const item of items) {
          urls[item.id] = URL.createObjectURL(item.blob)
        }
        blobUrlsRef.current = urls
        setBlobUrls(urls)
      } catch {
        // IndexedDB might not be available
        if (!cancelled) setLocalMediaLoaded(true)
      }
    }
    loadLocalMedia()
    return () => {
      cancelled = true
      Object.values(blobUrlsRef.current).forEach(URL.revokeObjectURL)
    }
  }, [clientParentId, parentId, offline, syncKey])

  const totalMedia = media.length + localMedia.length
  const reportCount = budget?.reportCount
  useEffect(() => {
    if (localMediaLoaded) reportCount?.(budgetKey, totalMedia + uploading.size)
  }, [reportCount, budgetKey, totalMedia, uploading.size, localMediaLoaded])
  const hasCapacity = budget ? budget.ready && budget.total < budget.maxFiles : totalMedia + uploading.size < maxFiles

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const effectiveParentId = clientParentId || parentId
    if (!effectiveParentId) return

    const supportedFiles = Array.from(files).filter(file => isSupportedMediaType(file.type))
    if (supportedFiles.length < files.length) setError(UNSUPPORTED_MEDIA_MESSAGE)
    const allowed = budget
      ? budget.reserve(budgetKey, supportedFiles.length)
      : Math.max(0, maxFiles - totalMedia - uploading.size)
    const filesToUpload = supportedFiles.slice(0, allowed).map(file => ({ file, tempId: crypto.randomUUID() }))
    if (filesToUpload.length === 0) {
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    updateUploadingCount(filesToUpload.length)
    setUploading(prev => new Set([...prev, ...filesToUpload.map(item => item.tempId)]))

    let gpsFired = false
    let datetimeFired = false

    for (const { file, tempId } of filesToUpload) {
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
          // Incidents do not have an offline path — they require an online
          // server action to be created, so there is never a queued state.
          if (parentType === 'incident') {
            setError('Cannot upload incident media while offline')
            setTimeout(() => setError(null), 5000)
            continue
          }
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

            if (!res.ok || !result.success || !result.media) {
              // An explicit rejection must not become an offline upload.
              setError(result.error || 'Upload failed')
              setTimeout(() => setError(null), 5000)
              continue
            }

            setMedia(prev => [...prev, result.media as MediaItem])
          } catch {
            // Incidents have no offline fallback — surface the error to the user.
            if (parentType === 'incident') {
              setError('Failed to upload incident media — please try again')
              setTimeout(() => setError(null), 5000)
            } else {
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
            }
          }
        }
      } catch {
        setError('Failed to prepare media. Please try again.')
      } finally {
        updateUploadingCount(-1)
        setUploading(prev => {
          const next = new Set(prev)
          next.delete(tempId)
          return next
        })
      }
    }

    // Reset input
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDelete = async (mediaId: string) => {
    const result = onDeleteMedia ? await onDeleteMedia(mediaId) : await deleteMedia(mediaId)
    if (result.success) {
      // useMediaUrls re-resolves on `media` change, so the deleted item drops
      // out of signedUrls automatically — no need to maintain a parallel map.
      setMedia(prev => prev.filter(m => m.id !== mediaId))
    } else if (result.error) {
      // Surface delete failures (e.g., RLS denied because parent is resolved)
      setError(result.error)
      setTimeout(() => setError(null), 5000)
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
      {/* Label with counter */}
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">{label}</span>
          <span className={`text-xs tabular-nums ${totalMedia >= maxFiles ? 'text-amber-500 font-medium' : 'text-gray-400'}`}>
            {budget ? `${budget.total}/${budget.maxFiles} in report` : `${totalMedia}/${maxFiles}`}
          </span>
        </div>
      )}

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
                    preload="metadata"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={signedUrls[item.id]}
                    alt={item.file_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
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
                  aria-label={`Remove ${item.file_name}`}
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
                    preload="metadata"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={blobUrls[item.id]}
                    alt={item.fileName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
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

      {/* Upload button */}
      {!readOnly && hasCapacity && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2"
        >
          <Camera className="w-4 h-4" />
          {offline ? 'Add Photos (queued for upload)' : 'Add Photos'}
        </button>
      )}

      {!readOnly && (
        <input
          ref={inputRef}
          type="file"
          accept={SUPPORTED_MEDIA_TYPES.join(',')}
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      )}
      {!readOnly && (
        <div className="space-y-2 text-xs text-gray-500">
          <p>
            For videos and additional photos beyond the report limit, email Dr. Andie directly at primatewatching@gmail.com.
          </p>
          <a
            href="mailto:primatewatching@gmail.com"
            className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 font-medium text-green-700 hover:bg-green-50"
          >
            Email Dr. Andie
          </a>
        </div>
      )}
    </div>
  )
}
