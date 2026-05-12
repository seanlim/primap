'use client'

import { useEffect } from 'react'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

export function shouldDisableServiceWorker(hostname: string) {
  return LOCAL_HOSTNAMES.has(hostname)
}

async function clearLocalServiceWorkerState() {
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((registration) => registration.unregister()))

  if ('caches' in window) {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith('primap-'))
        .map((cacheName) => caches.delete(cacheName))
    )
  }
}

export function registerServiceWorkerForHostname(hostname: string) {
  if (!('serviceWorker' in navigator)) return

  if (shouldDisableServiceWorker(hostname)) {
    void clearLocalServiceWorkerState()
    return
  }

  navigator.serviceWorker.register('/sw.js').catch(() => {
    // SW registration failed silently
  })
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    registerServiceWorkerForHostname(window.location.hostname)
  }, [])

  return null
}
