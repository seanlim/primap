import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaQuery, useIsDesktop } from '@/lib/hooks/use-media-query'

type ChangeListener = (e: { matches: boolean }) => void

function createMatchMedia(matches: boolean) {
  const listeners: ChangeListener[] = []
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn((_event: string, cb: ChangeListener) =>
      listeners.push(cb)
    ),
    removeEventListener: vi.fn((_event: string, cb: ChangeListener) => {
      const i = listeners.indexOf(cb)
      if (i >= 0) listeners.splice(i, 1)
    }),
    dispatchChange: (newMatches: boolean) =>
      listeners.forEach((l) => l({ matches: newMatches })),
    _listeners: listeners,
  }))
}

describe('useMediaQuery', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true when media matches', () => {
    window.matchMedia = createMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(true)
  })

  it('returns false when media does not match', () => {
    window.matchMedia = createMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)
  })

  it('updates when change event fires', () => {
    const mockMatchMedia = createMatchMedia(false)
    window.matchMedia = mockMatchMedia

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)

    const mediaInstance = mockMatchMedia.mock.results[0].value
    act(() => {
      mediaInstance.dispatchChange(true)
    })

    expect(result.current).toBe(true)
  })

  it('cleans up listener on unmount', () => {
    const mockMatchMedia = createMatchMedia(false)
    window.matchMedia = mockMatchMedia

    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    const mediaInstance = mockMatchMedia.mock.results.at(-1)?.value

    expect(mediaInstance).toBeDefined()
    expect(mediaInstance.removeEventListener).not.toHaveBeenCalled()

    unmount()

    expect(mediaInstance.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    )
  })
})

describe('useIsDesktop', () => {
  it('returns correct value based on media query', () => {
    window.matchMedia = createMatchMedia(true)
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(true)
  })
})
