<script lang="ts">
  import styles from './PlayerCanvas.module.css';
  // スペクトラムのプレビュー。曲の解析・画像・見た目の設定を状態から読み、毎フレーム描く。
  // この canvas は書き出し（リアルタイム）でも録画するため、SpectrumState に渡す
  import { onMount } from 'svelte';
  import { analyserSmoothing, SpectrumRenderer } from '#lib/spectrumRenderer.ts';
  import { getAudioState } from '#lib/state/audio.svelte.ts';
  import { getExportState } from '#lib/state/export.svelte.ts';
  import { getImageState } from '#lib/state/image.svelte.ts';
  import { getSpectrumState } from '#lib/state/spectrum.svelte.ts';

  const audio = getAudioState();
  const image = getImageState();
  const spectrum = getSpectrumState();
  const exporter = getExportState();

  // requestAnimationFrame の間隔はぶれるため、60 Hz の画面でフレームを飛ばさないよう、この分までは早くても描く
  const FRAME_TOLERANCE = 2;

  // 止まっていても描き直す印。設定・画像・大きさ（変えると canvas が消える）・解析のノードが変わったときに付ける
  let dirty = true;
  $effect(() => {
    void [spectrum.style, spectrum.width, spectrum.height, image.data, audio.analyser];
    dirty = true;
  });

  // 解析は動画のフレームレートと同じ回数で読む。平滑化の係数もそれに合わせる
  $effect(() => {
    if (audio.analyser)
      audio.analyser.smoothingTimeConstant = analyserSmoothing(exporter.settings.fps);
  });

  onMount(() => {
    const canvas = spectrum.canvas;
    if (!canvas) return;
    const renderer = new SpectrumRenderer(canvas.getContext('2d', { alpha: false })!);
    let lastTime = performance.now();
    let next = 0; // 次に描く時刻
    let lit = true; // 前のフレームで点いている（消えかけを含む）点があったか
    let frame = 0;
    // 画像そのものをスペクトラムとして見せる。画像がまだないときは背景だけにする
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      // 動画と同じフレームレートで描く。画面のリフレッシュレートが高くても、高速書き出しと同じ回数で解析を読む
      const interval = 1000 / exporter.settings.fps;
      if (now < next - FRAME_TOLERANCE) return;
      next += interval;
      // タブを戻したときなどに遅れを取り戻そうと続けて描かないよう、遅れたら今から数え直す
      if (next < now) next = now + interval;

      // 止まっていて点がすべて消えたら、変わるものが無いので描かない。止めた直後は解析に音が残っているため、
      // 消え切るまでは描く。録画中は、録画を始めてから再生するまでのあいだもフレームを送り続ける
      const playing = !audio.paused || exporter.status == 'generating';
      if (!playing && !lit && !dirty) return;
      dirty = false;
      const elapsed = now - lastTime;
      lastTime = now;
      lit = renderer.draw(audio.analyser, image.data, spectrum.style, elapsed);
    };
    frame = requestAnimationFrame(draw);
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
