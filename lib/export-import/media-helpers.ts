import { SupabaseClient } from '@supabase/supabase-js'
import { STORAGE_BUCKET, PAGE_SIZE } from './constants'

export async function fetchAllRows(
  client: SupabaseClient,
  table: string
): Promise<Record<string, unknown>[]> {
  const allRows: Record<string, unknown>[] = []
  let from = 0

  while (true) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`Failed to fetch ${table}: ${error.message}`)
    if (!data || data.length === 0) break

    allRows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return allRows
}

export async function downloadMediaFile(
  adminClient: SupabaseClient,
  filePath: string
): Promise<{ data: ArrayBuffer | null; error: string | null }> {
  try {
    const { data, error } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .download(filePath)

    if (error) return { data: null, error: error.message }
    if (!data) return { data: null, error: 'No data returned' }

    const buffer = await data.arrayBuffer()
    return { data: buffer, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function uploadMediaFile(
  adminClient: SupabaseClient,
  filePath: string,
  fileData: Uint8Array | Buffer,
  contentType?: string
): Promise<{ error: string | null; skipped: boolean }> {
  try {
    const { error } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, fileData, {
        upsert: false,
        contentType: contentType ?? inferContentType(filePath),
      })

    if (error) {
      // "Duplicate" or "already exists" means file already present — treat as skip
      if (error.message.includes('Duplicate') || error.message.includes('already exists')) {
        return { error: null, skipped: true }
      }
      return { error: error.message, skipped: false }
    }

    return { error: null, skipped: false }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unknown error', skipped: false }
  }
}

function inferContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    heic: 'image/heic',
    heif: 'image/heif',
  }
  return map[ext ?? ''] ?? 'application/octet-stream'
}
