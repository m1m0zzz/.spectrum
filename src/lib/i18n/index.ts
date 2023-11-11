import { browser } from '$app/environment';
import { init, register } from 'svelte-i18n';

export const defaultLocale = 'ja';
export const languagesList = [
	{ lang: 'ja', name: '日本語' },
	{ lang: 'en', name: 'English' }
];

register('ja', () => import('./locales/ja.json'));
register('en', () => import('./locales/en.json'));

init({
	fallbackLocale: defaultLocale,
	initialLocale: browser ? window.navigator.language : defaultLocale
});
