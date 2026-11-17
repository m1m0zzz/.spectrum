# .Spectrum

画像をスペクトラムとして動かし、曲に合わせた動画を書き出すアプリ。SvelteKit（adapter-static）で GitHub Pages に置く。

## コマンド

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run check`（svelte-check）・`npm run lint`（prettier と eslint）・`npx vitest run`

変更したら check・lint・テストを通す。

## 構成

- `src/lib/state/*.svelte.ts`：状態（音声・画像・見た目の設定・書き出し）。`routes/main/index.svelte` で作り、context で配る。共有する状態は props で中継せず、ここに置く
- `src/lib/components/`：props だけで動く汎用の部品
- `src/routes/main/`：ページの各区画
- `src/lib/*.ts`：描画・書き出し・ffmpeg などのロジック（テストは同じ場所の `*.test.ts`）

## 対応ブラウザ

画面に出している対応バージョンは、守らなければならない要件ではない。使いたい機能と、その機能に対応しているブラウザの割合（caniuse などで見る）を比べて、そのつど決め直す。新しい機能を使うために対応バージョンを上げるのはかまわない。上げるときは、どのブラウザがどれだけ使えなくなるかを示して相談する

## 書き方

- Svelte 5 の runes のみ。`vite.config.ts` で runes モードを強制しているので、`export let`・`$:`・`on:` は使えない。イベントは `onchange` などの関数の props にする
- スタイルは、コンポーネントごとの `*.module.css`（CSS Modules）。複数の部品で使うものだけ `src/styles/global.css` に置く
- コンポーネントのファイル名は PascalCase（`**/index.svelte` は除く）
- コメントは日本語で、理由が必要なものだけ書く
- コミットメッセージは日本語
