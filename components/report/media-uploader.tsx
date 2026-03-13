'use client'

import { useState, useRef, useEffect } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'
import { deleteMedia } from '@/lib/actions/observation-actions'
import { extractExifData } from '@/lib/utils/exif'
import { getSignedMediaUrl } from '@/lib/utils/storage'

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
  disabled?: boolean
}

export function MediaUploader({
  parentType,
  parentId,
  existingMedia,
  maxFiles = 10,
  onExifGps,
  onExifDatetime,
  disabled = false,
}: MediaUploaderProps) {
  const [media, setMedia] = useState<MediaItem[]>(existingMedia)
  const [uploading, setUploading] = useState<Set<string>>(new Set())
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  // Resolve signed URLs for all media items
  useEffect(() => {
    let cancelled = false
    async function resolveUrls() {
      const newUrls: Record<string, string> = {}
      for (const item of media) {
        if (!signedUrls[item.id]) {
          const url = await getSignedMediaUrl(item.file_path)
          if (cancelled) return
          newUrls[item.id] = url
        }
      }
      if (Object.keys(newUrls).length > 0) {
        setSignedUrls(prev => ({ ...prev, ...newUrls }))
      }
    }
    resolveUrls()
    return () => { cancelled = true }
  }, [media]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !parentId) return

    const filesToUpload = Array.from(files).slice(0, maxFiles - media.length)
    if (filesToUpload.length === 0) return

    let exifFired = false

    for (const file of filesToUpload) {
      const tempId = crypto.randomUUID()
      setUploading(prev => new Set(prev).add(tempId))

      try {
        // Extract EXIF from first image that has GPS
        const exifData = await extractExifData(file)
        if (!exifFired) {
          if (exifData.lat && exifData.lng && onExifGps) {
            onExifGps(exifData.lat, exifData.lng)
            exifFired = true
          }
          if (exifData.datetime && onExifDatetime) {
            onExifDatetime(exifData.datetime)
            exifFired = true
          }
        }

        const formData = new FormData()
        formData.append('file', file)
        formData.append('parentType', parentType)
        formData.append('parentId', parentId)
        if (exifData.lat != null) formData.append('exifLat', String(exifData.lat))
        if (exifData.lng != null) formData.append('exifLng', String(exifData.lng))
        if (exifData.datetime) formData.append('exifDatetime', exifData.datetime)

        const res = await fetch('/api/media', { method: 'POST', body: formData })
        const result = await res.json()

        if (result.success && result.media) {
          setMedia(prev => [...prev, result.media as MediaItem])
        }
      } catch {
        // Upload failed silently
      } finally {
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

  if (!parentId) {
    return (
      <div className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-xl">
        Save draft to upload photos
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Preview grid */}
      {(media.length > 0 || uploading.size > 0) && (
        <div className="grid grid-cols-3 gap-2">
          {media.map(item => (
            <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
              {signedUrls[item.id] ? (
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
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
              )}
              {!disabled && (
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
          {Array.from(uploading).map(id => (
            <div key={id} className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {!disabled && media.length < maxFiles && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2"
        >
          <Camera className="w-4 h-4" />
          Add Photos/Videos
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
