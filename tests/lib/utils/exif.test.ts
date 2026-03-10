import { describe, it, expect, vi, beforeEach } from 'vitest'
import exifr from 'exifr'
import { extractExifData } from '@/lib/utils/exif'

vi.mock('exifr', () => ({
  default: {
    gps: vi.fn(),
    parse: vi.fn(),
  },
}))

const mockGps = vi.mocked(exifr.gps)
const mockParse = vi.mocked(exifr.parse)

function makeImageFile(name = 'test.jpg') {
  return new File([''], name, { type: 'image/jpeg' })
}

function makeVideoFile(name = 'test.mp4') {
  return new File([''], name, { type: 'video/mp4' })
}

describe('extractExifData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all nulls immediately for video files', async () => {
    const file = makeVideoFile()
    const result = await extractExifData(file)

    expect(result).toEqual({ lat: null, lng: null, datetime: null })
    expect(mockGps).not.toHaveBeenCalled()
    expect(mockParse).not.toHaveBeenCalled()
  })

  it('extracts GPS and DateTimeOriginal from image with valid EXIF', async () => {
    mockGps.mockResolvedValue({ latitude: 1.3521, longitude: 103.8198 })
    mockParse.mockResolvedValue({ DateTimeOriginal: new Date('2025-06-15T10:30:00Z') })

    const result = await extractExifData(makeImageFile())

    expect(result.lat).toBe(1.3521)
    expect(result.lng).toBe(103.8198)
    expect(result.datetime).toBe('2025-06-15T10:30')
  })

  it('extracts GPS when date is unavailable', async () => {
    mockGps.mockResolvedValue({ latitude: 1.3521, longitude: 103.8198 })
    mockParse.mockResolvedValue(null)

    const result = await extractExifData(makeImageFile())

    expect(result.lat).toBe(1.3521)
    expect(result.lng).toBe(103.8198)
    expect(result.datetime).toBeNull()
  })

  it('extracts date when GPS is unavailable', async () => {
    mockGps.mockResolvedValue(null as never)
    mockParse.mockResolvedValue({ DateTimeOriginal: new Date('2025-06-15T10:30:00Z') })

    const result = await extractExifData(makeImageFile())

    expect(result.lat).toBeNull()
    expect(result.lng).toBeNull()
    expect(result.datetime).toBe('2025-06-15T10:30')
  })

  it('returns all nulls when neither GPS nor date is available', async () => {
    mockGps.mockResolvedValue(null as never)
    mockParse.mockResolvedValue(null)

    const result = await extractExifData(makeImageFile())

    expect(result).toEqual({ lat: null, lng: null, datetime: null })
  })

  it('treats GPS coordinates of 0 as falsy and does not set lat/lng', async () => {
    // gps?.latitude is 0 which is falsy, so the condition `gps?.latitude && gps?.longitude` fails
    mockGps.mockResolvedValue({ latitude: 0, longitude: 0 })
    mockParse.mockResolvedValue(null)

    const result = await extractExifData(makeImageFile())

    expect(result.lat).toBeNull()
    expect(result.lng).toBeNull()
  })

  it('continues to date extraction when GPS extraction throws', async () => {
    mockGps.mockRejectedValue(new Error('GPS parse error'))
    mockParse.mockResolvedValue({ DateTimeOriginal: new Date('2025-01-01T08:00:00Z') })

    const result = await extractExifData(makeImageFile())

    expect(result.lat).toBeNull()
    expect(result.lng).toBeNull()
    expect(result.datetime).toBe('2025-01-01T08:00')
  })

  it('still returns GPS when date extraction throws', async () => {
    mockGps.mockResolvedValue({ latitude: 51.5074, longitude: -0.1278 })
    mockParse.mockRejectedValue(new Error('Date parse error'))

    const result = await extractExifData(makeImageFile())

    expect(result.lat).toBe(51.5074)
    expect(result.lng).toBe(-0.1278)
    expect(result.datetime).toBeNull()
  })

  it('returns all nulls when both GPS and date extraction throw', async () => {
    mockGps.mockRejectedValue(new Error('GPS error'))
    mockParse.mockRejectedValue(new Error('Date error'))

    const result = await extractExifData(makeImageFile())

    expect(result).toEqual({ lat: null, lng: null, datetime: null })
  })

  it('returns null datetime when exifr.parse returns null', async () => {
    mockGps.mockResolvedValue(null as never)
    mockParse.mockResolvedValue(null)

    const result = await extractExifData(makeImageFile())

    expect(result.datetime).toBeNull()
  })

  it('returns null datetime when exifr.gps returns null', async () => {
    mockGps.mockResolvedValue(null as never)
    mockParse.mockResolvedValue({ DateTimeOriginal: new Date('2025-03-10T12:00:00Z') })

    const result = await extractExifData(makeImageFile())

    expect(result.lat).toBeNull()
    expect(result.lng).toBeNull()
    expect(result.datetime).toBe('2025-03-10T12:00')
  })

  it('ignores DateTimeOriginal when it is a string instead of a Date instance', async () => {
    mockGps.mockResolvedValue(null as never)
    mockParse.mockResolvedValue({ DateTimeOriginal: '2025-06-15 10:30:00' })

    const result = await extractExifData(makeImageFile())

    expect(result.datetime).toBeNull()
  })
})
