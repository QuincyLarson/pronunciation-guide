const CACHE_NAME = "learn-ipa-v1";
const CORE_URLS = [
  "/learn-ipa/",
  "/learn-ipa/about/",
  "/learn-ipa/reference/",
  "/learn-ipa/curriculum.json",
  "/learn-ipa/lookup.json",
  "/assets/site.css",
  "/assets/client/learn-ipa/app.js",
  "/assets/client/learn-ipa/word-links.js",
  "/assets/lib/learn-ipa/progress.js",
  "/assets/lib/learn-ipa/routes.js",
  "/favicon.svg"
];
const serviceWorker = globalThis as unknown as ServiceWorkerGlobalScope;

function shouldHandle(request: Request): boolean {
  if (request.method !== "GET") {
    return false;
  }

  const url = new URL(request.url);
  if (url.origin !== serviceWorker.location.origin) {
    return false;
  }

  return (
    url.pathname.startsWith("/learn-ipa/") ||
    url.pathname.startsWith("/assets/client/learn-ipa/") ||
    url.pathname.startsWith("/assets/lib/learn-ipa/") ||
    url.pathname.startsWith("/audio/")
  );
}

serviceWorker.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_URLS))
      .then(() => serviceWorker.skipWaiting())
  );
});

serviceWorker.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => serviceWorker.clients.claim())
  );
});

serviceWorker.addEventListener("fetch", (event: FetchEvent) => {
  if (!shouldHandle(event.request)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            void cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => cached ?? Response.error());

      return cached ?? network;
    })
  );
});
