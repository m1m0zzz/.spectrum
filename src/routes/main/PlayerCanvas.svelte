<script lang="ts">
  import styles from './PlayerCanvas.module.css';
  import { SpectrumRenderer } from '#lib/spectrumRenderer.ts';
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  export let imageLoaded: boolean;
  export let imageData: ImageData;
  export let nodeAnalyser: AnalyserNode | null;

  // parameters
  export let playerWidth: number;
  export let playerHeight: number;
  export let background: string;
  export let spectrumSensitivity: number;
  export let spectrumGridSize: number;
  export let spectrumSmoothTime: number;

  // visibility
  export let playerRef: HTMLCanvasElement | null;
  let renderer: SpectrumRenderer;
  let lastTime = performance.now();

  const draw = () => {
    if (!playerRef) return;
    requestAnimationFrame(draw);

    const now = performance.now();
    const elapsed = now - lastTime;
    lastTime = now;

    // 画像そのものをスペクトラムとして見せる。画像がまだないときは背景だけにする
    renderer.draw(
      nodeAnalyser,
      imageLoaded ? imageData : null,
      {
        background,
        sensitivity: spectrumSensitivity,
        gridSize: spectrumGridSize,
        smoothTime: spectrumSmoothTime
      },
      elapsed
    );
  };

  onMount(() => {
    if (!playerRef) return;
    renderer = new SpectrumRenderer(playerRef.getContext('2d', { alpha: false })!);
    draw();

    dispatch('mount', {
      playerRef: playerRef
    });
  });
</script>

<section>
  <div class={styles.container}>
    <canvas
      id="player"
      bind:this={playerRef}
      width={playerWidth}
      height={playerHeight}
      style:background
    ></canvas>
  </div>
</section>
