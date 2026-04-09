import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MediaGallery, type GalleryMediaItem } from '@/components/report/media-gallery'

// ─── Mocks ──────────────────────────────────────────────────────────────────
//
// `MediaGallery` resolves URLs by:
//   1. Checking IndexedDB blob cache via `cacheGet`
//   2. Falling back to `getSignedMediaUrl` (network)
// We mock both so the test environment doesn't touch real storage.

const mockCacheGet = vi.fn()
const mockCacheSet = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/offline/db', () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
}))

const mockGetSignedMediaUrl = vi.fn()

vi.mock('@/lib/utils/storage', () => ({
  getSignedMediaUrl: (...args: unknown[]) => mockGetSignedMediaUrl(...args),
  // MediaGallery imports these constants for its default bucket arg. Mocking
  // the module replaces ALL exports, so we have to re-expose them by hand.
  OBSERVATION_MEDIA_BUCKET: 'observation-media',
  INCIDENT_MEDIA_BUCKET: 'incident-media',
}))

// jsdom doesn't implement URL.createObjectURL/revokeObjectURL — provide stubs.
const createObjectURLSpy = vi.fn(() => 'blob:mock-url')
const revokeObjectURLSpy = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mockCacheGet.mockResolvedValue(null)
  mockGetSignedMediaUrl.mockResolvedValue('https://signed.example.com/file.jpg')
  // jsdom doesn't define these
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURLSpy, configurable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURLSpy, configurable: true })
  // Default to online
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
  // Stub global fetch (the gallery caches blobs in background)
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['x'])),
  }) as unknown as typeof fetch
})

afterEach(() => {
  cleanup()
})

const photo: GalleryMediaItem = {
  id: 'm-1',
  file_path: 'user/parent/photo.jpg',
  file_name: 'photo.jpg',
  media_type: 'PHOTO',
}

const video: GalleryMediaItem = {
  id: 'm-2',
  file_path: 'user/parent/clip.mp4',
  file_name: 'clip.mp4',
  media_type: 'VIDEO',
}

describe('MediaGallery', () => {
  it('renders nothing (returns null) when media is empty', () => {
    const { container } = render(<MediaGallery media={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('defaults to observation-media bucket when bucket prop is omitted', async () => {
    render(<MediaGallery media={[photo]} />)

    await waitFor(() => {
      expect(mockGetSignedMediaUrl).toHaveBeenCalledWith('user/parent/photo.jpg', 'observation-media')
    })
  })

  it('uses incident-media bucket when bucket="incident-media"', async () => {
    render(<MediaGallery media={[photo]} bucket="incident-media" />)

    await waitFor(() => {
      expect(mockGetSignedMediaUrl).toHaveBeenCalledWith('user/parent/photo.jpg', 'incident-media')
    })
    expect(mockGetSignedMediaUrl).not.toHaveBeenCalledWith(expect.anything(), 'observation-media')
  })

  it('renders an <img> for PHOTO media items', async () => {
    render(<MediaGallery media={[photo]} bucket="incident-media" />)

    await waitFor(() => {
      const img = screen.getByAltText('photo.jpg') as HTMLImageElement
      expect(img.tagName).toBe('IMG')
      expect(img.src).toBe('https://signed.example.com/file.jpg')
    })
  })

  it('renders a <video controls> for VIDEO media items', async () => {
    render(<MediaGallery media={[video]} bucket="incident-media" />)

    await waitFor(() => {
      const videoEl = document.querySelector('video') as HTMLVideoElement
      expect(videoEl).toBeTruthy()
      expect(videoEl.hasAttribute('controls')).toBe(true)
    })
  })

  it('shows error icon when getSignedMediaUrl rejects', async () => {
    mockGetSignedMediaUrl.mockRejectedValueOnce(new Error('signed url failed'))

    render(<MediaGallery media={[photo]} bucket="incident-media" />)

    await waitFor(() => {
      expect(screen.getByText('Unavailable')).toBeInTheDocument()
    })
  })

  it('uses cached blob when available (no network call)', async () => {
    const cachedBlob = new Blob(['cached'], { type: 'image/jpeg' })
    mockCacheGet.mockResolvedValueOnce(cachedBlob)

    render(<MediaGallery media={[photo]} bucket="incident-media" />)

    await waitFor(() => {
      const img = screen.getByAltText('photo.jpg') as HTMLImageElement
      expect(img.src).toBe('blob:mock-url')
    })
    expect(mockGetSignedMediaUrl).not.toHaveBeenCalled()
    expect(createObjectURLSpy).toHaveBeenCalled()
  })

  it('shows error icon when offline and no cached blob', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    mockCacheGet.mockResolvedValueOnce(null)

    render(<MediaGallery media={[photo]} bucket="incident-media" />)

    await waitFor(() => {
      expect(screen.getByText('Unavailable')).toBeInTheDocument()
    })
    expect(mockGetSignedMediaUrl).not.toHaveBeenCalled()
  })

  it('renders multiple items in a grid', async () => {
    render(<MediaGallery media={[photo, video]} bucket="incident-media" />)

    await waitFor(() => {
      expect(screen.getByAltText('photo.jpg')).toBeInTheDocument()
      expect(document.querySelector('video')).toBeTruthy()
    })
  })

  it('revokes blob URLs on unmount', async () => {
    const cachedBlob = new Blob(['cached'], { type: 'image/jpeg' })
    mockCacheGet.mockResolvedValueOnce(cachedBlob)

    const { unmount } = render(<MediaGallery media={[photo]} bucket="incident-media" />)
    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalled()
    })

    unmount()
    expect(revokeObjectURLSpy).toHaveBeenCalled()
  })
})
