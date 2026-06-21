// Cache names — bump the suffix if you need to wipe everything on next activate
const SHELL  = 'shell-v1'   // HTML document
const ASSETS = 'assets-v1'  // hashed JS/CSS/images

// ── Lifecycle ─────────────────────────────────────────────────────────────────

self.addEventListener('install', () => {
  // Take control immediately; don't wait for existing tabs to close
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  // Delete caches from older SW versions
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL && k !== ASSETS).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch routing ─────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only intercept same-origin requests; let third-party (Supabase, fonts) pass through
  if (url.origin !== self.location.origin) return

  // version.json must never be served from cache — it's the freshness signal
  if (url.pathname === '/version.json') return

  // HTML navigation → network-first, fall back to cache only when offline
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request))
    return
  }

  // Content-hashed assets (/assets/*.js, /assets/*.css) → cache-first (URL = identity)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstAsset(request))
    return
  }

  // Everything else same-origin (images, favicon, etc.) → cache-first
  event.respondWith(cacheFirstAsset(request))
})

// ── Strategies ────────────────────────────────────────────────────────────────

async function networkFirstShell(request) {
  try {
    // cache:'no-store' bypasses the browser HTTP cache so we always hit the wire.
    // This is the key that prevents iOS standalone from ever showing stale HTML.
    const response = await fetch(request, { cache: 'no-store' })
    if (response.ok) {
      const cache = await caches.open(SHELL)
      await cache.put(request, response.clone())
    }
    return response
  } catch {
    // Offline (or server unreachable) — serve the last-known-good shell
    const cached =
      await caches.match(request, { cacheName: SHELL }) ??
      await caches.match('/',      { cacheName: SHELL })
    return cached ?? new Response('App is offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(ASSETS)
      await cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Asset unavailable offline', { status: 503 })
  }
}
