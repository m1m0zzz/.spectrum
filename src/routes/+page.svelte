<script lang="ts">
	import Mouse from './mouse.svelte';
	import Nav from './nav.svelte';
	import Main from './main/index.svelte';
	import Footer from './footer.svelte';
</script>

<svelte:head>
	<title>.Spectrum | ドット絵風スペクトルアナライザー</title>
	<meta name="keywords" content="作曲,DTM,無料,plugin,audio visualizer" />
	<meta
		name="description"
		content="ドット絵風の周波数アナライザー、SNSのWIP動画投稿などにお使い下さい。"
	/>
	<meta property="og:title" content=".Spectrum | ドット絵風スペクトルアナライザー" />
	<meta
		property="og:description"
		content="ドット絵風の周波数アナライザー、SNSのWIP動画投稿などにお使い下さい。"
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://m1m0zzz.github.io/.spectrum/" />
	<meta property="og:image" content="https://m1m0zzz.github.io/.spectrum/assets/thumbnail.jpg" />
	<meta property="og:site_name" content=".Spectrum" />
</svelte:head>

<Mouse />
<Nav />
<Main />
<Footer />
