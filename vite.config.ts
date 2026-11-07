import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	// @ffmpeg/ffmpeg は自分の worker を new URL(..., import.meta.url) で読むため、開発サーバーの事前バンドルから外す
	optimizeDeps: {
		exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
