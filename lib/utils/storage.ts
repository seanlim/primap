import { createClient } from '@/lib/supabase/client'

/**
 * Storage bucket identifiers. The string literals match the buckets that
 * exist in Supabase storage; any code that references buckets should import
 * these constants instead of hardcoding the string.
 */
export const OBSERVATION_MEDIA_BUCKET = 'observation-media' as const
export const INCIDENT_MEDIA_BUCKET = 'incident-media' as const

export type MediaBucket = typeof OBSERVATION_MEDIA_BUCKET | typeof INCIDENT_MEDIA_BUCKET

export function getPublicMediaUrl(filePath: string, bucket: MediaBucket = OBSERVATION_MEDIA_BUCKET): string {
  const supabase = createClient()
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
  return data.publicUrl
}

export async function getSignedMediaUrl(filePath: string, bucket: MediaBucket = OBSERVATION_MEDIA_BUCKET): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, 3600) // 1 hour expiry
  if (error || !data?.signedUrl) {
    // Fallback to public URL
    return getPublicMediaUrl(filePath, bucket)
  }
  return data.signedUrl
}
