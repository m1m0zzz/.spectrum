/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from "$service-worker";

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;
const ASSETS = [
	...build, // the app itself
	...files  // everything in `static`
];

const coepCredentialless = false; // TODO

self.addEventListener("install", (event) => {
  async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

  console.log("install service worker");
	event.waitUntil(addFilesToCache());
});

self.addEventListener("activate", (event) => {
	// Remove previous cached data from disk
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener("fetch", (event) => {
	// ignore POST requests etc
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" ||
      url.origin.startsWith('chrome-extension') ||
      url.origin.includes('extension') ||
      !(url.origin.indexOf('http') === 0)) return;

  async function respond() {
    const cache = await caches.open(CACHE);

		// `build`/`files` can always be served from the cache
		if (ASSETS.includes(url.pathname)) {
			return cache.match(url.pathname);
		}

		// for everything else, try the network first, but
		// fall back to the cache if we"re offline
		try {
			const response = await fetch(event.request);

			if (response.status === 0) {
				return response;
			}

			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}

			const newHeaders = new Headers(response.headers);
			newHeaders.set("Cross-Origin-Embedder-Policy",
				coepCredentialless ? "credentialless" : "require-corp"
			);
			newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

			return new Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers: newHeaders,
			});
		} catch {
			return cache.match(event.request);
		}
	}

	event.respondWith(respond());
});
