import { readFileSync } from 'node:fs';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// フッターのライセンス表示のソースへのリンクに、同梱している Mediabunny の版を使う
const mediabunnyVersion: string = JSON.parse(
  readFileSync(new URL('./node_modules/mediabunny/package.json', import.meta.url), 'utf-8')
).version;

export default defineConfig(({ command }) => ({
  plugins: [
    sveltekit({
      adapter: adapter({
        pages: 'build',
        assets: 'build',
        fallback: undefined,
        precompress: false,
        strict: true
      }),
      // GitHub Pages ではリポジトリ名の下に置かれるため、ビルドでは deploy.yml の BASE_PATH を使う
      paths: {
        base: command === 'serve' ? '' : ((process.env.BASE_PATH ?? '') as '' | `/${string}`)
      },
      // このプロジェクトのコンポーネントは runes モード（Svelte 5 の書き方）でコンパイルし、
      // 古い書き方（export let・$:・on: など）を使うとエラーにする。node_modules のものはそれぞれの書き方のままにする
      dynamicCompileOptions: ({ filename }) =>
        filename.includes('/node_modules/') ? undefined : { runes: true }
    })
  ],
  define: {
    __MEDIABUNNY_VERSION__: JSON.stringify(mediabunnyVersion)
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
}));
