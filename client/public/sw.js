// Care Net Portal — Service Worker
// Network-first for HTML, cache-first for static assets, never cache API

const CACHE = "cnp-v4";

// These are NEVER cached — always fetched fresh from network
const NEVER_CACHE = ["/", "/index.html"];

self.addEventListener("install", e => {
  // Skip waiting so new SW activates immediately
  e.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", e => {
  // Delete ALL old caches on activate
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // 1. Never intercept API calls
  if (url.pathname.startsWith("/api/")) return;

  // 2. Never cache index.html or root — always network
  if (NEVER_CACHE.includes(url.pathname) || url.pathname === "") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // 3. Cache-first for static assets (JS, CSS, images, fonts)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok && e.request.method === "GET") {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});
