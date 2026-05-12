import { waitFor } from '@testing-library/react'
import {
  registerServiceWorkerForHostname,
  shouldDisableServiceWorker,
} from '@/components/pwa/sw-register'

describe('service worker registration', () => {
  function mockServiceWorker() {
    const unregister = vi.fn().mockResolvedValue(true)
    const registration = { unregister }
    const register = vi.fn().mockResolvedValue(registration)
    const getRegistrations = vi.fn().mockResolvedValue([registration])

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { register, getRegistrations },
    })

    return { register, getRegistrations, unregister }
  }

  function mockCaches(cacheNames: string[]) {
    const keys = vi.fn().mockResolvedValue(cacheNames)
    const deleteCache = vi.fn().mockResolvedValue(true)
    const cacheStorage = { keys, delete: deleteCache }

    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: cacheStorage,
    })
    vi.stubGlobal('caches', cacheStorage)

    return { keys, deleteCache }
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('disables service workers on localhost hosts', () => {
    expect(shouldDisableServiceWorker('localhost')).toBe(true)
    expect(shouldDisableServiceWorker('127.0.0.1')).toBe(true)
    expect(shouldDisableServiceWorker('0.0.0.0')).toBe(true)
    expect(shouldDisableServiceWorker('::1')).toBe(true)
    expect(shouldDisableServiceWorker('primap.example')).toBe(false)
  })

  it('unregisters existing workers and deletes only primap caches on localhost', async () => {
    const serviceWorker = mockServiceWorker()
    const cacheStorage = mockCaches(['primap-v1', 'primap-v2', 'unrelated-cache'])

    registerServiceWorkerForHostname('localhost')

    await waitFor(() => expect(serviceWorker.getRegistrations).toHaveBeenCalled())

    expect(serviceWorker.register).not.toHaveBeenCalled()
    expect(serviceWorker.unregister).toHaveBeenCalled()
    expect(cacheStorage.keys).toHaveBeenCalled()
    expect(cacheStorage.deleteCache).toHaveBeenCalledWith('primap-v1')
    expect(cacheStorage.deleteCache).toHaveBeenCalledWith('primap-v2')
    expect(cacheStorage.deleteCache).not.toHaveBeenCalledWith('unrelated-cache')
  })

  it('registers the service worker outside localhost', async () => {
    const serviceWorker = mockServiceWorker()
    mockCaches(['primap-v2'])

    registerServiceWorkerForHostname('primap.example')

    await waitFor(() => expect(serviceWorker.register).toHaveBeenCalledWith('/sw.js'))

    expect(serviceWorker.getRegistrations).not.toHaveBeenCalled()
  })
})
