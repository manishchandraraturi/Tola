/* Tola service worker — hand-written, no next-pwa.
 *
 * Rules:
 *  - App shell is precached so the phone opens without signal.
 *  - GET /api/state is network-first with a cached fallback.
 *  - POST/PUT/PATCH/DELETE are never intercepted, so an offline write reaches
 *    the IndexedDB queue instead of a half-cached response.
 *  - /api/auth and /api/otp are never cached, in either direction.
 *  - Any other /api path is left to the network.
 */
const SHELL_CACHE = "tola-shell-v1";
const DATA_CACHE = "tola-data-v1";
const SHELL_ASSETS = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];

// Kept as a named function so the policy can be unit-tested directly.
function cachePolicy(method, pathname) {
  if (method !== "GET") return { handle: false, reason: "non-get" };
  if (!pathname) return { handle: false, reason: "no-path" };
  if (pathname.startsWith("/api/auth")) return { handle: false, reason: "auth" };
  if (pathname.startsWith("/api/otp")) return { handle: false, reason: "otp" };
  if (pathname === "/api/state") {
    return { handle: true, strategy: "network-first", cache: DATA_CACHE };
  }
  if (pathname.startsWith("/api/")) return { handle: false, reason: "api-uncached" };
  if (pathname === "/" || pathname.endsWith(".html")) {
    return { handle: true, strategy: "network-first", cache: SHELL_CACHE };
  }
  return { handle: true, strategy: "cache-first", cache: SHELL_CACHE };
}

// Exposed only for tests; the fetch handler below uses the same function.
self.__TOLA_CACHE_POLICY__ = cachePolicy;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((name) => name !== SHELL_CACHE && name !== DATA_CACHE)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await caches.match("/");
      if (shell) return shell;
    }
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Never intercept a write. Offline writes go through the app's queue.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.get("authorization")) return;

  const policy = cachePolicy(request.method, url.pathname);
  if (!policy.handle) return;

  if (policy.strategy === "network-first") {
    event.respondWith(networkFirst(request, policy.cache));
  } else {
    event.respondWith(cacheFirst(request, policy.cache));
  }
});
