import { browser } from '$app/env';
// 読み込むだけで i18n を初期化する（辞書の登録と init）
import '#lib/i18n/index.ts';
import { locale, waitLocale } from 'svelte-i18n';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async () => {
  if (browser) {
    locale.set(window.navigator.language);
  }
  await waitLocale();
};

// adapter-static で GitHub Pages に置くため、ビルド時に HTML にする
export const prerender = true;
