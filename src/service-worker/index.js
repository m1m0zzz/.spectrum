import { self } from '$app/service-worker';
import { dev, version } from '$app/env';
import { immutable, prerendered } from '$app/manifest';

// キャッシュに載せるものと返し方
// - immutable（Vite が出力したファイル。名前に内容のハッシュが付く）: 同じ URL の中身は変わらないので、キャッシュ優先
//   - ffmpeg のコア（src/lib/ffmpeg.ts で同梱。1 つ約 32MB）は事前キャッシュしない。入れるとページを開いただけで
//     全員がダウンロードすることになる。使ったときにキャッシュし、版が変わらない限りデプロイをまたいで使い回す
//   - それ以外は事前キャッシュする（オフラインで開けるように）
// - prerendered（ページの HTML）: ネットワーク優先。デプロイ後のリロードですぐ新しい版になる。
//   事前キャッシュはオフライン用で、同じ版の immutable と組になる
// - static のファイル（アイコン・manifest.json など）: 名前が変わらないため、キャッシュ優先にすると古い版が残る。
//   ネットワーク優先にし、取れたものをオフライン用にキャッシュする。表示に要るものではないので事前キャッシュはしない
//   （サイト全体のスタイル・フォント・ロゴは src から Vite で取り込み、immutable に入れている）

// デプロイごとに変わるキャッシュ。新しい service worker が有効になったら古い版は消す
const CACHE = `cache-${version}`;
// ffmpeg のコアのキャッシュ。名前を固定し、いまの版で使わなくなったファイルだけ消す
const FFMPEG_CACHE = 'ffmpeg-core';

// $app/manifest のパスは base からの相対なので、fetch の url.pathname と比べられるよう絶対パスにする。
// service worker は base の直下に置かれるため、scope が base にあたる
/** @param {string} path */
const toPathname = (path) => new URL(path, self.registration.scope).pathname;
/** @param {string} pathname */
const isFFmpegCore = (pathname) => pathname.includes('ffmpeg-core');

const IMMUTABLE = new Set(immutable.map(({ path }) => toPathname(path)));
const PAGES = prerendered.map(({ path }) => toPathname(path));
// ルートのページ。オフラインで、キャッシュに無い URL を開いたときの代わりに返す
const ROOT = toPathname('');
// immutable の置き場所（kit.appDir の既定値 _app）
const IMMUTABLE_DIR = toPathname('_app/immutable/');

const coepCredentialless = false; // TODO

// GitHub Pages ではレスポンスヘッダーを付けられないため、ここで COOP / COEP を付けてページを crossOriginIsolated にする
// （ffmpeg のマルチスレッド版が SharedArrayBuffer を使う）。COEP が require-corp のページから作る worker は、
// スクリプトにも COEP が無いと起動しない。@ffmpeg/ffmpeg の worker もキャッシュから返すため、
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
		await cache.addAll([
			...[...IMMUTABLE].filter((pathname) => !isFFmpegCore(pathname)),
			// HTML は HTTP キャッシュ（GitHub Pages は max-age=600）を通さず取る。
			// 古い HTML を取ると、この版の immutable と組にならない
			...PAGES.map((pathname) => new Request(pathname, { cache: 'reload' }))
		]);
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
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (dev || (key !== CACHE && key !== FFMPEG_CACHE)) await caches.delete(key);
		}
		// ffmpeg のコアは、いまの版で使わなくなったもの（版を上げる前のもの）だけ消す
		if (!dev) {
			const ffmpegCache = await caches.open(FFMPEG_CACHE);
			for (const request of await ffmpegCache.keys()) {
				if (!IMMUTABLE.has(new URL(request.url).pathname)) await ffmpegCache.delete(request);
			}
		}
		// 開いているページも、すぐにこの service worker の管理下に置く
		if (dev) await self.clients.claim();
	}

	event.waitUntil(deleteOldCaches());
});

/**
 * immutable: キャッシュ優先。中身はハッシュで決まるので、どの版のキャッシュにあっても同じものを返せる
 * @param {FetchEvent} event
 * @param {URL} url
 */
async function cacheFirst(event, url) {
	const cached = await caches.match(url.pathname);
	if (cached) return cached;

	const response = await fetch(event.request);
	if (response.status === 200) {
		// 書き込みの完了は待たずに返す（ffmpeg のコアは大きく、待つとダウンロードの進み具合がページに伝わらない）
		const copy = response.clone();
		const cacheName = isFFmpegCore(url.pathname) ? FFMPEG_CACHE : CACHE;
		event.waitUntil(caches.open(cacheName).then((cache) => cache.put(url.pathname, copy)));
	}
	return response;
}

/**
 * ページ・static のファイル: ネットワーク優先。取れなければ（オフライン）キャッシュから返す
 * @param {Request} request
 * @param {URL} url
 */
async function networkFirst(request, url) {
	const cache = await caches.open(CACHE);
	try {
		const response = await fetch(request);
		if (response.status === 200) await cache.put(url.pathname, response.clone());
		return response;
	} catch (error) {
		const cached =
			(await cache.match(url.pathname)) ??
			(request.mode === 'navigate' ? await cache.match(ROOT) : undefined);
		if (cached) return cached;
		throw error;
	}
}

self.addEventListener('fetch', (event) => {
	if (dev) return;

	const { request } = event;
	const url = new URL(request.url);
	// 自分のオリジンの GET だけを扱う（ほかはブラウザに任せる）
	if (request.method !== 'GET' || url.origin !== self.location.origin) return;
	// version.json は新しい版があるかを確かめるためのものなので、キャッシュしない
	if (url.pathname === toPathname('_app/version.json')) return;

	event.respondWith(
		(url.pathname.startsWith(IMMUTABLE_DIR)
			? cacheFirst(event, url)
			: networkFirst(request, url)
		).then(withIsolationHeaders)
	);
});
