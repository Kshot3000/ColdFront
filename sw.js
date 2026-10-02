/* THE COLD FRONT — service worker (v1.167.0)
   Conservative by design: pages stay network-first (a fan never sees a
   stale score because of this file), versioned static assets ride
   stale-while-revalidate, and every cross-origin request (live scores,
   weather, market APIs) bypasses the worker entirely — the app's own
   snapshot and localStorage fallbacks own those failure modes. */
const CACHE = "cf-shell-1.167.0";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./img/favicon.svg",
  "./img/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // live APIs: network only

  // Pages + data: network-first, cache is the offline fallback only.
  if (req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.includes("/data/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // Same-origin static (CSS/JS/images — URLs are ?v= versioned):
  // serve the cache instantly, refresh it in the background.
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
