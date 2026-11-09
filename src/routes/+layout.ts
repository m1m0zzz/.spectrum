import { browser } from '$app/env';
import '#lib/i18n/index.ts'; // Import to initialize. Important :)
import { locale, waitLocale } from 'svelte-i18n';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async () => {
	if (browser) {
		locale.set(window.navigator.language);
	}
	await waitLocale();
};

// This can be false if you're using a fallback (i.e. SPA mode)
export const prerender = true;
