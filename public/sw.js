// Bump the version whenever caching behaviour changes; old caches are deleted on activate.
const CACHE_NAME = "spaetzle-glas-v2";
const CORE_ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/** Vite puts content hashes into the file names below assets/, so these never change. */
function isHashedAsset(url) {
  return url.pathname.includes("/assets/");
}

function putInCache(request, response) {
  if (response && response.status === 200) {
    const responseClone = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (isHashedAsset(requestUrl)) {
    // Cache first: a hashed file is never updated in place.
    event.respondWith(
      caches.match(event.request).then(
        (cached) => cached || fetch(event.request).then((res) => putInCache(event.request, res))
      )
    );
    return;
  }

  // Network first for the page, photos and media, so a new deployment shows up on the
  // next visit. The cache is only the fallback when she is offline.
  event.respondWith(
    fetch(event.request)
      .then((res) => putInCache(event.request, res))
      .catch(() =>
        caches
          .match(event.request, { ignoreSearch: true })
          .then((cached) => cached || Response.error())
      )
  );
});
