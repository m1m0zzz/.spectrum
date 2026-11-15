<script lang="ts">
  import { onMount } from 'svelte';
  import styles from './Mouse.module.css';

  let mouse: HTMLDivElement;

  onMount(() => {
    // マウスなど、カーソルを重ねられる入力が主のときだけ出す。タッチ主体の端末では、タップのたびに
    // その位置へ飛んで残るだけになるため出さない。マウスをつないだ・外したときにも追従する
    const canHover = window.matchMedia('(hover: hover)');

    let ok = true;
    const player = document.querySelector('#player') as Element;
    player.addEventListener('mouseenter', () => (ok = false), false);
    player.addEventListener('mouseleave', () => (ok = true), false);

    const style = window.getComputedStyle(mouse);
    const width = parseInt(style.width);
    const height = parseInt(style.height);
    window.addEventListener('mousemove', (e) => {
      if (!canHover.matches) return;
      const x = e.clientX;
      const y = e.clientY;
      mouse.style.opacity = ok ? '1' : '0';
      mouse.style.transform = `translate(${x - (x % width)}px, ${y - (y % height)}px)`;
    });
    canHover.addEventListener('change', () => {
      if (!canHover.matches) mouse.style.opacity = '0';
    });

    // ボタンや入力欄などの上では大きくする。音声を読み込んでから出る範囲のバーや、トリミングの枠のように
    // 後から出る要素もあるため、要素ごとにイベントを付けず、ページ全体でカーソルの下の要素を調べる。
    // コンポーネントのクラス名は CSS Modules で変わるため、それ以外の要素は data-stalker-target で示す
    const hoverTargets = 'a,button,input,select,.pixel-button,[role=option],[data-stalker-target]';
    document.addEventListener('mouseover', (e) => {
      const target = e.target instanceof Element ? e.target.closest(hoverTargets) : null;
      mouse.classList.toggle(styles.hover, target != null);
    });
    // ウィンドウの外へ出たら戻す
    document.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget) mouse.classList.remove(styles.hover);
    });
  });
</script>

<div class={styles.stalker} bind:this={mouse}></div>
