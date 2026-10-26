// New uploads accept photos only. Storage retains support for existing videos.
export const SUPPORTED_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const UNSUPPORTED_MEDIA_MESSAGE = 'Unsupported media format. Use JPEG, PNG or WebP photos only.'

export function isSupportedMediaType(type: string): boolean {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(type)
}
