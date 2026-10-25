// Keep aligned with the MIME types allowed by both Storage media buckets.
export const SUPPORTED_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
] as const

export const UNSUPPORTED_MEDIA_MESSAGE = 'Unsupported media format. Use JPEG, PNG, WebP, MP4 or MOV.'

export function isSupportedMediaType(type: string): boolean {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(type)
}
