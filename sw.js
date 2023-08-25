// Cache name
const CACHE_NAME = "app-caches-v2";
// Cache targets
const urlsToCache = [
  "./",
  "./index.html",
  "./styles/style.css",
  "./styles/modern-css-reset/reset.min.css",
  "./main.js",
  "./assets/logo_192_trim.png",
  "./assets/thumbnail.jpg",
  "./assets/x12y12pxMaruMinya_2023-07-14/x12y12pxMaruMinya.ttf",
  "./assets/icons/android-chrome-192x192.png",
  "./assets/icons/android-chrome-512x512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/browserconfig.xml",
  "./assets/icons/favicon-16x16.png",
  "./assets/icons/favicon-32x32.png",
  "./assets/icons/favicon.ico",
  "./assets/icons/mstile-150x150.png",
  "./assets/icons/safari-pinned-tab.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => {
        return response ? response : fetch(event.request);
      })
  );
});
