const CACHE_NAME = 'primap-static-v1'
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])
const IS_LOCALHOST = LOCAL_HOSTNAMES.has(self.location.hostname)
const IMMUTABLE_ASSET = /\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?|css|js|pdf)$/

// Nothing is precached. Every app route is per-user and server rendered, so
// pre-caching them on install triggered several full dynamic renders and could
// serve one volunteer's page to another. Only content-hashed build assets are
// cached, and only after the browser requests them.

self.addEventListener('install', () => {
  self.skipWaiting()
})

// Activate: drop caches from previous versions, including the old HTML cache.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('primap-') && (IS_LOCALHOST || key !== CACHE_NAME))
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/') || IMMUTABLE_ASSET.test(url.pathname)
}

// Fetch: static build assets only. Documents, RSC payloads and API responses
// always go to the network so per-user data is never cached.
self.addEventListener('fetch', (event) => {
  if (IS_LOCALHOST) return

  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Skip Supabase calls (auth, REST, realtime)
  if (url.hostname.includes('supabase')) return
  if (url.origin !== self.location.origin) return

  // Never intercept the worker script or RSC payload requests
  if (url.pathname === '/sw.js' || url.searchParams.has('_rsc')) return

  if (!isImmutableAsset(url)) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
    })
  )
})
