import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPublicMediaUrl, getSignedMediaUrl } from '@/lib/utils/storage'

const mockGetPublicUrl = vi.fn()
const mockCreateSignedUrl = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        getPublicUrl: mockGetPublicUrl,
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  }),
}))

describe('storage utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPublicMediaUrl', () => {
    it('returns the public URL for the given file path', () => {
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.example.com/observation-media/photo.jpg' },
      })

      const url = getPublicMediaUrl('photo.jpg')

      expect(url).toBe('https://storage.example.com/observation-media/photo.jpg')
      expect(mockGetPublicUrl).toHaveBeenCalledWith('photo.jpg')
    })
  })

  describe('getSignedMediaUrl', () => {
    it('returns the signed URL on success', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://storage.example.com/signed/photo.jpg?token=abc' },
        error: null,
      })

      const url = await getSignedMediaUrl('photo.jpg')

      expect(url).toBe('https://storage.example.com/signed/photo.jpg?token=abc')
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('photo.jpg', 3600)
    })

    it('falls back to public URL when createSignedUrl returns an error', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'Not authorized' },
      })
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.example.com/observation-media/photo.jpg' },
      })

      const url = await getSignedMediaUrl('photo.jpg')

      expect(url).toBe('https://storage.example.com/observation-media/photo.jpg')
    })

    it('falls back to public URL when signedUrl is null', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: null },
        error: null,
      })
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.example.com/observation-media/photo.jpg' },
      })

      const url = await getSignedMediaUrl('photo.jpg')

      expect(url).toBe('https://storage.example.com/observation-media/photo.jpg')
    })

    it('falls back to public URL when signedUrl is undefined', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: {},
        error: null,
      })
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.example.com/observation-media/photo.jpg' },
      })

      const url = await getSignedMediaUrl('photo.jpg')

      expect(url).toBe('https://storage.example.com/observation-media/photo.jpg')
    })
  })
})
