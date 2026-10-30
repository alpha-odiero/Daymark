const CACHE_NAME = "daymark-journal-shell-v8";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.png",
  "./icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

async function cacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    APP_SHELL.map(url =>
      fetch(url, { cache: "reload" })
        .then(response => {
          if (response.ok) return cache.put(url, response);
        })
        .catch(() => {})
    )
  );
  try {
    const response = await fetch("./index.html", { cache: "reload" });
    if (!response.ok) return;
    const html = await response.clone().text();
    await cache.put("./index.html", response);
    const assets = [...html.matchAll(/(?:src|href)="((?:\.\/)?assets\/[^"]+)"/g)].map(match => match[1]);
    await Promise.all(
      [...new Set(assets)].map(url =>
        fetch(url, { cache: "reload" })
          .then(asset => {
            if (asset.ok) return cache.put(url, asset);
          })
          .catch(() => {})
      )
    );
  } catch {}
}

self.addEventListener("install", event => {
  event.waitUntil(cacheShell());
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isCacheable(response) {
  return response && response.ok && response.type === "basic";
}

function putInCache(request, response) {
  if (!isCacheable(response)) return;
  const copy = response.clone();
  caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (isCacheable(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy)).catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          return cached || caches.match("./index.html") || caches.match("./");
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(response => {
          putInCache(event.request, response);
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
