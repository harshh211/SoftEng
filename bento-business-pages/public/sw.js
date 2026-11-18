// Bento service worker (NFR-8.3: installable PWA).
//
// What it does:
//  - Pre-caches the app shell so Bento opens fast and can be installed.
//  - Pages (HTML): network first, falling back to the cache, then offline.html.
//  - CSS, JS, icons: served from cache, refreshed in the background.
//  - Firebase traffic (Auth, Firestore, the SDK on gstatic.com) is never touched,
//    so data is always live and login always talks to Firebase.
//
// IMPORTANT: bump CACHE_VERSION whenever you change a file in APP_SHELL,
// or users may keep seeing the old version.

const CACHE_VERSION = "bento-v3";

const APP_SHELL = [
  "/",
  "/index.html",
  "/login.html",
  "/signup.html",
  "/offline.html",
  "/business.html",
  "/business-edit.html",
  "/manifest.webmanifest",
  "/css/styles.css",
  "/css/base.css",
  "/css/header.css",
  "/css/business.css",
  "/js/firebase-config.js",
  "/js/firebase.js",
  "/js/auth.js",
  "/js/businesses.js",
  "/js/business-edit.js",
  "/js/business-page.js",
  "/js/pwa.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  // Delete caches from older versions.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Lets the page tell a waiting worker to take over (used by the update banner in pwa.js).
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle our own GET requests. Firebase, gstatic and other origins pass straight through.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Firebase Hosting reserved URLs (/__/auth, /__/firebase/init.js, ...).
  if (url.pathname.startsWith("/__/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(stripQuery(request), response.clone());
    return response;
  } catch {
    return (await cache.match(stripQuery(request)))
      || (await cache.match("/offline.html"));
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  return refresh;
}

// "/index.html?source=pwa" and "/index.html" share one cache entry.
function stripQuery(request) {
  const url = new URL(request.url);
  url.search = "";
  return url.toString();
}
