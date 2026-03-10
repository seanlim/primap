import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGeolocation } from '@/lib/hooks/use-geolocation'

describe('useGeolocation', () => {
  let mockGetCurrentPosition: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockGetCurrentPosition = vi.fn()
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrentPosition },
      writable: true,
      configurable: true,
    })
  })

  it('returns correct initial state', () => {
    const { result } = renderHook(() => useGeolocation())

    expect(result.current.lat).toBeNull()
    expect(result.current.lng).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.getCurrentPosition).toBe('function')
  })

  it('sets error when geolocation is not supported', () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current.getCurrentPosition()
    })

    expect(result.current.error).toBe('Geolocation is not supported')
    expect(result.current.loading).toBe(false)
  })

  it('returns lat/lng on success', () => {
    mockGetCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({
        coords: { latitude: 1.35, longitude: 103.82 },
      } as GeolocationPosition)
    })

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current.getCurrentPosition()
    })

    expect(result.current.lat).toBe(1.35)
    expect(result.current.lng).toBe(103.82)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('returns error message on geolocation error', () => {
    mockGetCurrentPosition.mockImplementation(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({
          code: 1,
          message: 'User denied geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError)
      }
    )

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current.getCurrentPosition()
    })

    expect(result.current.error).toBe('User denied geolocation')
    expect(result.current.loading).toBe(false)
    expect(result.current.lat).toBeNull()
    expect(result.current.lng).toBeNull()
  })
})
