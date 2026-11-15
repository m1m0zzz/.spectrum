<script lang="ts">
  import { onMount } from 'svelte';
  import styles from './Mouse.module.css';

  let mouse: HTMLDivElement | undefined = $state();

  onMount(() => {
    const el = mouse;
    if (!el) return;
    // 付けたリスナーは、まとめて外せるようにする
    const listening = new AbortController();
    const { signal } = listening;

    // マウスなど、カーソルを重ねられる入力が主のときだけ出す。タッチ主体の端末では、タップのたびに
    // その位置へ飛んで残るだけになるため出さない。マウスをつないだ・外したときにも追従する
    const canHover = window.matchMedia('(hover: hover)');

    let ok = true;
    const player = document.querySelector('#player') as Element;
    player.addEventListener('mouseenter', () => (ok = false), { signal });
    player.addEventListener('mouseleave', () => (ok = true), { signal });

    const style = window.getComputedStyle(el);
    const width = parseInt(style.width);
    const height = parseInt(style.height);
    window.addEventListener(
      'mousemove',
      (e) => {
        if (!canHover.matches) return;
        const x = e.clientX;
        const y = e.clientY;
        el.style.opacity = ok ? '1' : '0';
        el.style.transform = `translate(${x - (x % width)}px, ${y - (y % height)}px)`;
      },
      { signal }
    );
    canHover.addEventListener(
      'change',
      () => {
        if (!canHover.matches) el.style.opacity = '0';
      },
      { signal }
    );

    // ボタンや入力欄などの上では大きくする。音声を読み込んでから出る範囲のバーや、トリミングの枠のように
    // 後から出る要素もあるため、要素ごとにイベントを付けず、ページ全体でカーソルの下の要素を調べる。
    // コンポーネントのクラス名は CSS Modules で変わるため、それ以外の要素は data-stalker-target で示す
    const hoverTargets = 'a,button,input,select,.pixel-button,[role=option],[data-stalker-target]';
    document.addEventListener(
      'mouseover',
      (e) => {
        const target = e.target instanceof Element ? e.target.closest(hoverTargets) : null;
        el.classList.toggle(styles.hover, target != null);
      },
      { signal }
    );
    // ウィンドウの外へ出たら戻す
    document.addEventListener(
      'mouseout',
      (e) => {
        if (!e.relatedTarget) el.classList.remove(styles.hover);
      },
      { signal }
    );
    return () => listening.abort();
  });
</script>

<div class={styles.stalker} bind:this={mouse}></div>
