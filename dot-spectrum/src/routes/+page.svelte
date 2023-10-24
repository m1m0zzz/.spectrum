<!-- TODO
  - styles
  - service worker
-->

<svelte:head>
  <title>.Spectrum | ドット絵風スペクトルアナライザー</title>
  <meta name="keywords" content="作曲,DTM,無料,plugin,audio visualizer">
  <meta name=”description” content="ドット絵風の周波数アナライザー、SNSのWIP動画投稿などにお使い下さい。">
  <meta property="og:title" content=".Spectrum | ドット絵風スペクトルアナライザー" />
  <meta property="og:description" content="ドット絵風の周波数アナライザー、SNSのWIP動画投稿などにお使い下さい。" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://m1m0zzz.github.io/.spectrum/" />
  <meta property="og:image" content="https://m1m0zzz.github.io/.spectrum/assets/thumbnail.jpg" />
  <meta property="og:site_name" content=".Spectrum" />
  <link rel="stylesheet" href="/styles/modern-css-reset/reset.min.css">
  <link rel="stylesheet" href="/styles/style.css">

  <link rel="apple-touch-icon" sizes="180x180" href="./assets/icons/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="./assets/icons/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="./assets/icons/favicon-16x16.png">
  <link rel="manifest" href="./manifest.json">
  <link rel="mask-icon" href="./assets/icons/safari-pinned-tab.svg" color="#5bbad5">
  <link rel="shortcut icon" href="./assets/icons/favicon.ico">
  <meta name="apple-mobile-web-app-title" content=".Spectrum">
  <meta name="application-name" content=".Spectrum">
  <meta name="msapplication-TileColor" content="#ffffff">
  <meta name="msapplication-config" content="./assets/icons/browserconfig.xml">
  <meta name="theme-color" content="#ffffff">
</svelte:head>

<script lang="ts">
  import Mouse from "./mouse.svelte";
  import Nav from "./nav.svelte";
  import Main from "./main/index.svelte";
	import Footer from "./footer.svelte";
</script>

<Mouse />
<Nav />
<Main />
<Footer />
