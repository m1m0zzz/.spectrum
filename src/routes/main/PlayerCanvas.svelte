<script lang="ts">
  import styles from './PlayerCanvas.module.css';
  // スペクトラムのプレビュー。曲の解析・画像・見た目の設定を状態から読み、毎フレーム描く。
  // この canvas は書き出し（リアルタイム）でも録画するため、SpectrumState に渡す
  import { onMount } from 'svelte';
  import { SpectrumRenderer } from '#lib/spectrumRenderer.ts';
  import { getAudioState } from '#lib/state/audio.svelte.ts';
  import { getImageState } from '#lib/state/image.svelte.ts';
  import { getSpectrumState } from '#lib/state/spectrum.svelte.ts';

  const audio = getAudioState();
  const image = getImageState();
  const spectrum = getSpectrumState();

  onMount(() => {
    const canvas = spectrum.canvas;
    if (!canvas) return;
    const renderer = new SpectrumRenderer(canvas.getContext('2d', { alpha: false })!);
    let lastTime = performance.now();
    let frame = 0;
    // 画像そのものをスペクトラムとして見せる。画像がまだないときは背景だけにする
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const now = performance.now();
      const elapsed = now - lastTime;
      lastTime = now;
      renderer.draw(audio.analyser, image.data, spectrum.style, elapsed);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  });
</script>

<section>
  <div class={styles.container}>
    <canvas
      id="player"
      bind:this={spectrum.canvas}
      width={spectrum.width}
      height={spectrum.height}
      style:background={spectrum.background}
    ></canvas>
  </div>
</section>
