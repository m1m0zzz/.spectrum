import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// フッターの FFmpeg のソースへのリンクに、同梱しているコアの版を使う
const ffmpegCoreVersion: string = JSON.parse(
	readFileSync(new URL('./node_modules/@ffmpeg/core/package.json', import.meta.url), 'utf-8')
).version;

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__FFMPEG_CORE_VERSION__: JSON.stringify(ffmpegCoreVersion)
	},
	resolve: {
		// ffmpeg のコアのファイルを ?url で取り込むための別名。パッケージ名で書くと、SvelteKit の SSR ビルドで
		// パッケージのルート（@ffmpeg/core?url）が解決できずに失敗するため、dist/esm を直接指す
		alias: {
			'$ffmpeg-core': fileURLToPath(
				new URL('./node_modules/@ffmpeg/core/dist/esm', import.meta.url)
			),
			'$ffmpeg-core-mt': fileURLToPath(
				new URL('./node_modules/@ffmpeg/core-mt/dist/esm', import.meta.url)
			)
		}
	},
	build: {
		// 小さいアセットを data URL に埋め込まない。core-mt の worker（約 2KB）が data URL になると、
		// オリジンを持たない worker になり、マルチスレッドに要る SharedArrayBuffer を共有できない。
		// ?url で取り込むアセットはいまは ffmpeg のコアだけ
		assetsInlineLimit: 0
	},
	// @ffmpeg/ffmpeg は自分の worker を new URL(..., import.meta.url) で読むため、開発サーバーの事前バンドルから外す
	optimizeDeps: {
		exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
