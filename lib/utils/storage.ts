import { createClient } from '@/lib/supabase/client'

export function getPublicMediaUrl(filePath: string): string {
  const supabase = createClient()
  const { data } = supabase.storage.from('observation-media').getPublicUrl(filePath)
  return data.publicUrl
}

export async function getSignedMediaUrl(filePath: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from('observation-media')
    .createSignedUrl(filePath, 3600) // 1 hour expiry
  if (error || !data?.signedUrl) {
    // Fallback to public URL
    return getPublicMediaUrl(filePath)
  }
  return data.signedUrl
}
