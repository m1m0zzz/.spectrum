<script lang="ts">
	import type { Snippet } from 'svelte';
	// サイト全体のスタイル。static に置くとファイル名が変わらず、service worker が古い版を返して
	// 新しいマークアップと食い違うことがあるため、Vite で取り込んでファイル名にハッシュを付ける
	import '../styles/modern-css-reset/reset.min.css';
	import '../styles/style.css';

	let { children }: { children: Snippet } = $props();
</script>

{@render children()}
