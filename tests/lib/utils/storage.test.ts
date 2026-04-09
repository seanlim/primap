import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPublicMediaUrl, getSignedMediaUrl } from '@/lib/utils/storage'

const mockGetPublicUrl = vi.fn()
const mockCreateSignedUrl = vi.fn()
const mockFrom = vi.fn(() => ({
  getPublicUrl: mockGetPublicUrl,
  createSignedUrl: mockCreateSignedUrl,
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: mockFrom,
    },
  }),
}))

describe('storage utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPublicMediaUrl', () => {
    it('defaults to observation-media bucket when no bucket arg', () => {
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.example.com/observation-media/photo.jpg' },
      })

      const url = getPublicMediaUrl('photo.jpg')

      expect(url).toBe('https://storage.example.com/observation-media/photo.jpg')
      expect(mockFrom).toHaveBeenCalledWith('observation-media')
      expect(mockGetPublicUrl).toHaveBeenCalledWith('photo.jpg')
    })

    it('uses observation-media bucket when explicitly passed', () => {
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.example.com/observation-media/photo.jpg' },
      })

      const url = getPublicMediaUrl('photo.jpg', 'observation-media')

      expect(url).toBe('https://storage.example.com/observation-media/photo.jpg')
      expect(mockFrom).toHaveBeenCalledWith('observation-media')
    })

    it('uses incident-media bucket when passed', () => {
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.example.com/incident-media/photo.jpg' },
      })

      const url = getPublicMediaUrl('photo.jpg', 'incident-media')

      expect(url).toBe('https://storage.example.com/incident-media/photo.jpg')
      expect(mockFrom).toHaveBeenCalledWith('incident-media')
    })
  })

  describe('getSignedMediaUrl', () => {
    it('defaults to observation-media bucket and returns the signed URL', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://storage.example.com/signed/photo.jpg?token=abc' },
        error: null,
      })

      const url = await getSignedMediaUrl('photo.jpg')

      expect(url).toBe('https://storage.example.com/signed/photo.jpg?token=abc')
      expect(mockFrom).toHaveBeenCalledWith('observation-media')
      expect(mockCreateSignedUrl).toHaveBeenCalledWith('photo.jpg', 3600)
    })

    it('uses incident-media bucket when passed', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://storage.example.com/signed/incident-photo.jpg?token=xyz' },
        error: null,
      })

      const url = await getSignedMediaUrl('photo.jpg', 'incident-media')

      expect(url).toBe('https://storage.example.com/signed/incident-photo.jpg?token=xyz')
      expect(mockFrom).toHaveBeenCalledWith('incident-media')
    })

    it('falls back to public URL on the SAME bucket when createSignedUrl errors (incident)', async () => {
      mockCreateSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'Not authorized' },
      })
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://storage.example.com/incident-media/photo.jpg' },
      })

      const url = await getSignedMediaUrl('photo.jpg', 'incident-media')

      expect(url).toBe('https://storage.example.com/incident-media/photo.jpg')
      // Both signed-url attempt and public-url fallback must hit incident-media
      expect(mockFrom).toHaveBeenCalledWith('incident-media')
      expect(mockFrom).not.toHaveBeenCalledWith('observation-media')
    })

    it('falls back to public URL when createSignedUrl returns an error (default bucket)', async () => {
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
