'use client'

import { Loader2, ImageOff } from 'lucide-react'
import { OBSERVATION_MEDIA_BUCKET, type MediaBucket } from '@/lib/utils/storage'
import { useMediaUrls } from './use-media-urls'

export interface GalleryMediaItem {
  id: string
  file_path: string
  file_name: string
  media_type: string
}

interface MediaGalleryProps {
  media: GalleryMediaItem[]
  bucket?: MediaBucket
}

export function MediaGallery({ media, bucket = OBSERVATION_MEDIA_BUCKET }: MediaGalleryProps) {
  const signedUrls = useMediaUrls(media, bucket)

  if (media.length === 0) return null

  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      {media.map(item => {
        const url = signedUrls[item.id]
        const isLoading = !url
        const isError = url === 'error'

        return (
          <div key={item.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
            {!isLoading && !isError ? (
              item.media_type === 'VIDEO' ? (
                <video
                  src={url}
                  className="w-full h-full object-cover"
                  controls
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={item.file_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )
            ) : isError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                <ImageOff className="w-5 h-5 text-gray-300" />
                <span className="text-[10px] text-gray-400">Unavailable</span>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
