import { self } from '$app/service-worker';
import { dev, version } from '$app/env';
import { immutable, assets } from '$app/manifest';

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;
// ffmpeg のコア（src/lib/ffmpeg.ts で同梱。1 つ約 32MB）は事前キャッシュしない。
// 入れるとページを開いただけで全員がダウンロードすることになる。使ったときに下の fetch でキャッシュされる
// $app/manifest のパスは base からの相対なので、fetch の url.pathname と比べられるよう絶対パスにする。
// service worker は base の直下に置かれるため、scope が base にあたる
/** @param {{ path: string }} asset */
const toPathname = (asset) => new URL(asset.path, self.registration.scope).pathname;
const ASSETS = [
	...immutable.map(toPathname), // the app itself
	...assets.map(toPathname) // everything in `static`
].filter((path) => !path.includes('ffmpeg-core'));

const coepCredentialless = false; // TODO

// GitHub Pages ではレスポンスヘッダーを付けられないため、ここで COOP / COEP を付けてページを crossOriginIsolated にする
// （ffmpeg のマルチスレッド版が SharedArrayBuffer を使う）。COEP が require-corp のページから作る worker は、
// スクリプトにも COEP が無いと起動しない。事前キャッシュには @ffmpeg/ffmpeg の worker も入るため、
// キャッシュから返すものも含めてすべてのレスポンスに付ける
/** @param {Response} response */
const withIsolationHeaders = (response) => {
	// opaque なレスポンス（status 0）はヘッダーを変えられない
	if (response.status === 0) return response;
	const headers = new Headers(response.headers);
	headers.set(
		'Cross-Origin-Embedder-Policy',
		coepCredentialless ? 'credentialless' : 'require-corp'
	);
	headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
};

// 開発サーバーでは service worker は何もしない（キャッシュもヘッダーの付与もしない）。
// - version がビルドごとにしか変わらないため、キャッシュすると編集が反映されないことがある
// - COOP / COEP を付けて crossOriginIsolated にすると、マルチスレッド版の ffmpeg が選ばれるが、
//   開発サーバーはその worker（ffmpeg-core.worker.js）を通常のスクリプトとして読める形で配らず
//   （Cannot use import statement outside a module）、書き出しが終わらなくなる。
//   開発中はヘッダーを付けず、シングルスレッド版を使わせる

self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	console.log('install service worker');
	if (dev) {
		// キャッシュを使っていた古い service worker を待たずに置き換える
		event.waitUntil(self.skipWaiting());
		return;
	}
	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	// Remove previous cached data from disk
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			// 開発中は、以前のキャッシュも含めてすべて消す
			if (dev || key !== CACHE) await caches.delete(key);
		}
		// 開いているページも、すぐにこの service worker の管理下に置く
		if (dev) await self.clients.claim();
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', (event) => {
	if (dev) return;

	// ignore POST requests etc
	const url = new URL(event.request.url);
	if (
		event.request.method !== 'GET' ||
		url.origin.startsWith('chrome-extension') ||
		url.origin.includes('extension') ||
		!(url.origin.indexOf('http') === 0)
	)
		return;

	async function respond() {
		const cache = await caches.open(CACHE);

		// `immutable`/`assets` can always be served from the cache
		if (ASSETS.includes(url.pathname)) {
			const cached = await cache.match(url.pathname);
			if (cached) return withIsolationHeaders(cached);
		}

		// for everything else, try the network first, but
		// fall back to the cache if we're offline
		try {
			const response = await fetch(event.request);

			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}

			return withIsolationHeaders(response);
		} catch (error) {
			const cached = await cache.match(event.request);
			if (cached) return withIsolationHeaders(cached);
			throw error;
		}
	}

	event.respondWith(respond());
});
