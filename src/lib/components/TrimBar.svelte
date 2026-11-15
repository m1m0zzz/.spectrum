<script lang="ts">
  import styles from './TrimBar.module.css';
  // スマホの動画編集アプリのような、範囲（開始・終了）と再生位置をまとめて操作するバー。
  // 範囲の外は点線の枠だけにし、範囲は枠で囲んで、左右のハンドルで伸び縮みさせる。再生位置は白い縦棒で示す。
  // ハンドルと縦棒はそれぞれ role="slider" にし、キーボードでも動かせるようにする。
  // 範囲の中には、曲の波形を白いドットで描く。
  // 範囲のハンドルを長押しすると、バーがハンドルのまわりを横に 10 倍にズームし、細かく調節できる（離すと戻る）
  import { onDestroy } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import type { HTMLAttributes } from 'svelte/elements';
  import { _ } from 'svelte-i18n';
  import { clamp } from '#lib/util.ts';
  import { resamplePeaks } from '#lib/waveform.ts';

  type Props = {
    // 曲の長さ（秒）と、範囲・再生位置（秒）
    duration: number;
    start: number;
    end: number;
    current: number;
    disabled?: boolean;
    // 波形（区間ごとの振幅の最大。computePeaks の結果）。読み込む前やデコードできなかったときは null
    waveform?: Float32Array | null;
    // 再生位置を動かした（範囲内に収めた秒）
    onseek?: (time: number) => void;
    // 範囲を動かし始めた・動かし終えた
    ontrimstart?: () => void;
    ontrimend?: () => void;
  } & HTMLAttributes<HTMLDivElement>;
  // ほかの属性（data-* など）は rest に入れ、いちばん外の要素に付ける
  let {
    duration,
    start = $bindable(),
    end = $bindable(),
    current,
    disabled = false,
    waveform = null,
    onseek,
    ontrimstart,
    ontrimend,
    ...rest
  }: Props = $props();

  // 範囲の最短の長さ（秒）
  const MIN_LENGTH = 0.1;
  // ハンドルが再生位置にこれより近づいたら（px）、再生位置に吸着させる
  const SNAP_PX = 8;
  // 長押しでズームする倍率と、長押しとみなす時間（ミリ秒）・動きの幅（px。これより動いたら、止まるのを待ち直す）
  const ZOOM = 10;
  const LONG_PRESS_MS = 600;
  const LONG_PRESS_SLOP_PX = 4;

  // バーに見せている時間の幅（秒）。ふだんは曲全体で、長押しの間はズームする。
  // ズームはハンドル（anchorTime 秒）の画面上の位置を動かさずに行う。こうすると、ズームしても
  // ハンドルが指の下から逃げず、表示の幅も曲の中に収まる（viewStart = anchorFraction × (曲の長さ − 幅)）
  const zoom = new Tween(0, { duration: 200, easing: cubicOut });
  let anchorTime = $state(0);
  let anchorFraction = $state(0);
  const viewLength = $derived(duration + (duration / ZOOM - duration) * zoom.current);
  const viewStart = $derived(
    clamp(anchorTime - anchorFraction * viewLength, 0, duration - viewLength)
  );

  let track: HTMLElement | undefined = $state();
  let playhead: HTMLElement | undefined = $state();
  let wave: HTMLCanvasElement | undefined = $state();
  let trackWidth = $state(0);

  // 波形を、1 ドットを 1 画素とした canvas に描き、帯いっぱいに拡大して見せる。
  // 帯の高さ 22 ドットのうち、上下 1 ドットは枠なので、真ん中の 20 ドットに、中央から上下対称の棒を立てる。
  // 棒の高さは曲の中でいちばん大きい音を 20 ドットとし、2・4・…・20 ドットの 10 段にする
  const WAVE_ROWS = 22;
  // ズームしても棒の高さが変わらないよう、高さは曲全体でいちばん大きい音に合わせる
  const waveMax = $derived(waveform ? waveform.reduce((a, b) => Math.max(a, b), 0) : 0);
  const drawWave = (
    canvas: HTMLCanvasElement | undefined,
    peaks: Float32Array | null,
    max: number,
    width: number,
    from: number,
    to: number
  ) => {
    if (!canvas) return;
    const dot = parseFloat(getComputedStyle(canvas).getPropertyValue('--dot')) || 3;
    const columns = Math.max(1, Math.round(width / dot));
    canvas.width = columns;
    canvas.height = WAVE_ROWS;
    const ctx = canvas.getContext('2d');
    if (!ctx || !peaks || max <= 0) return;
    const values = resamplePeaks(peaks, columns, from, to);
    const center = WAVE_ROWS / 2;
    const steps = center - 1;
    ctx.fillStyle = 'white';
    values.forEach((value, x) => {
      const level = value / max;
      // ほぼ無音のところは描かない
      if (level < 0.02) return;
      const half = Math.max(1, Math.round(level * steps));
      ctx.fillRect(x, center - half, 1, half * 2);
    });
  };
  $effect(() =>
    drawWave(
      wave,
      waveform,
      waveMax,
      trackWidth,
      duration > 0 ? viewStart / duration : 0,
      duration > 0 ? (viewStart + viewLength) / duration : 1
    )
  );

  // 数値の入力欄から範囲外や逆転した値が入っても、表示が崩れないようにする
  const s = $derived(clamp(start, 0, duration));
  const e = $derived(clamp(end, s, duration));
  // バーの左端からの位置（%）。ズームしているときは、見せている幅の外（0 未満・100 超）になりうる
  const position = (t: number, from: number, length: number) =>
    length > 0 ? ((t - from) / length) * 100 : 0;
  const startPos = $derived(position(s, viewStart, viewLength));
  const endPos = $derived(position(e, viewStart, viewLength));
  const currentPos = $derived(position(current, viewStart, viewLength));
  // 範囲の枠と波形は、見せている幅の中だけに描く。幅の外に出たハンドルと縦棒は隠す
  const frameLeft = $derived(clamp(startPos, 0, 100));
  const frameRight = $derived(clamp(endPos, 0, 100));
  const visible = (pos: number) => (-0.01 <= pos && pos <= 100.01 ? null : 'hidden');
  // 隠しても要素はその位置に残り、バーの外の遠くにあるとページにスクロールバーが出るため、位置もバーの中に止める
  const inside = (pos: number) => `${clamp(pos, 0, 100)}%`;

  // 入力欄に出す値。0.01 秒に丸める
  const round = (t: number) => Math.round(t * 100) / 100;

  // バーの外も含めた、横位置にあたる秒（つかんだ位置のずれを正しくとるため、ここでは端で止めない）
  const trackRect = () => track?.getBoundingClientRect() ?? new DOMRect();
  const timeAt = (clientX: number) => {
    const rect = trackRect();
    return viewStart + ((clientX - rect.left) / rect.width) * viewLength;
  };
  const pxPerSecond = () => trackRect().width / viewLength;
  const snap = (t: number, lo: number, hi: number) =>
    lo <= current && current <= hi && Math.abs(t - current) * pxPerSecond() <= SNAP_PX
      ? current
      : t;

  const moveStart = (t: number, snapping = false) => {
    const hi = Math.max(0, e - MIN_LENGTH);
    const v = clamp(t, 0, hi);
    start = round(snapping ? snap(v, 0, hi) : v);
  };
  const moveEnd = (t: number, snapping = false) => {
    const lo = Math.min(duration, s + MIN_LENGTH);
    const v = clamp(t, lo, duration);
    end = round(snapping ? snap(v, lo, duration) : v);
  };
  const seek = (t: number) => onseek?.(clamp(t, s, e));

  // ドラッグ。押した位置とハンドル・縦棒の画面上のずれ（px）を保ち、つかんだところから動かす。
  // ずれを秒でなく px で持つのは、ズームで 1px あたりの秒が変わっても、つかんだところがずれないようにするため
  type Target = 'start' | 'end' | 'playhead';
  let dragging: Target | null = $state(null);
  let offsetPx = 0;
  const valueOf = (target: Target) => ({ start: s, end: e, playhead: current })[target];

  // 長押し。ハンドルを押したまま LONG_PRESS_MS の間ほぼ動かさなければズームする。
  // 押した直後だけでなく、ドラッグして（スワイプして）から止めたときもズームする
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  // 止まっているかを測る基準の位置と、いまの指の位置
  let pressX = 0;
  let pressY = 0;
  let pointerX = 0;
  let zoomed = false;
  const cancelPress = () => {
    clearTimeout(pressTimer);
    pressTimer = undefined;
  };
  const waitForRest = (x: number, y: number) => {
    cancelPress();
    pressX = x;
    pressY = y;
    pressTimer = setTimeout(zoomIn, LONG_PRESS_MS);
  };
  const zoomIn = () => {
    pressTimer = undefined;
    if (dragging != 'start' && dragging != 'end') return;
    anchorTime = valueOf(dragging);
    anchorFraction = viewLength > 0 ? (anchorTime - viewStart) / viewLength : 0;
    // ドラッグの途中では、ハンドルが端で止まったり再生位置に吸着したりして、指からずれていることがある。
    // ズームの後に動かしたときハンドルが跳ばないよう、いまの指とハンドルのずれを測り直す
    const rect = trackRect();
    offsetPx = pointerX - (rect.left + anchorFraction * rect.width);
    zoomed = true;
    zoom.target = 1;
    // 対応している端末（Android など）では、ズームしたことを振動で知らせる
    navigator.vibrate?.(10);
  };
  const zoomOut = () => {
    if (!zoomed) return;
    zoomed = false;
    // 戻るときは、離したときのハンドルの位置を動かさずに戻す
    anchorTime = valueOf(dragging ?? 'start');
    anchorFraction = viewLength > 0 ? (anchorTime - viewStart) / viewLength : 0;
    zoom.target = 0;
  };
  onDestroy(cancelPress);

  const onPointerDown = (event: PointerEvent) => {
    if (disabled || duration <= 0 || event.button != 0 || dragging) return;
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-target]');
    const target = (el?.dataset.target ?? 'playhead') as Target;
    const rect = trackRect();
    // 縦棒の外（バーの空いたところ）を押したときは、そこへ再生位置を移す
    offsetPx = el
      ? event.clientX -
        (rect.left + (position(valueOf(target), viewStart, viewLength) / 100) * rect.width)
      : 0;
    dragging = target;
    event.preventDefault();
    (el ?? playhead)?.focus();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    if (target == 'playhead') {
      if (!el) seek(timeAt(event.clientX));
    } else {
      ontrimstart?.();
      pointerX = event.clientX;
      waitForRest(event.clientX, event.clientY);
    }
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    pointerX = event.clientX;
    // 動いたら、そこから止まるのを待ち直す
    if (
      (dragging == 'start' || dragging == 'end') &&
      !zoomed &&
      Math.hypot(event.clientX - pressX, event.clientY - pressY) > LONG_PRESS_SLOP_PX
    ) {
      waitForRest(event.clientX, event.clientY);
    }
    let t = timeAt(event.clientX - offsetPx);
    // ズームしている間は、見せている幅の外へは動かさない（ハンドルが見えなくなるため）
    if (zoomed) t = clamp(t, viewStart, viewStart + viewLength);
    if (dragging == 'start') moveStart(t, true);
    else if (dragging == 'end') moveEnd(t, true);
    else seek(t);
  };
  const onPointerUp = () => {
    cancelPress();
    zoomOut();
    if (dragging && dragging != 'playhead') ontrimend?.();
    dragging = null;
  };

  // キーボード。←→↑↓ で 0.1 秒、PageUp / PageDown で 1 秒、Home / End で端まで
  const onKeydown = (target: Target) => (event: KeyboardEvent) => {
    const value = { start: s, end: e, playhead: current }[target];
    const delta = {
      ArrowLeft: -0.1,
      ArrowDown: -0.1,
      ArrowRight: 0.1,
      ArrowUp: 0.1,
      PageDown: -1,
      PageUp: 1,
      Home: -Infinity,
      End: Infinity
    }[event.key];
    if (delta == undefined || disabled) return;
    event.preventDefault();
    const t = Number.isFinite(delta) ? value + delta : delta > 0 ? duration : 0;
    if (target == 'start') moveStart(t);
    else if (target == 'end') moveEnd(t);
    else seek(t);
    if (target != 'playhead') ontrimend?.();
  };

  const seconds = (t: number) => $_('export_range_value', { values: { value: t.toFixed(1) } });
  const format = (t: number) => {
    const sec = Number.isFinite(t) ? Math.max(0, Math.floor(t)) : 0;
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };
</script>

<!-- 使う側が渡したほかの属性（data-* など）は、いちばん外の要素に付ける -->
<div
  {...rest}
  class={[styles.root, disabled && styles.disabled, dragging != null && styles.dragging]}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  oncontextmenu={(event) => event.preventDefault()}
>
  <div class={styles.track} bind:this={track} bind:clientWidth={trackWidth}>
    <span class={styles.frame} style:left="{frameLeft}%" style:width="{frameRight - frameLeft}%"
    ></span>
    <!-- 波形は範囲の中だけを見せる。範囲を動かすたびに描き直さないよう、範囲の外を切り抜いて隠す -->
    <canvas
      class={styles.wave}
      bind:this={wave}
      aria-hidden="true"
      style:clip-path="inset(0 {100 - frameRight}% 0 {frameLeft}%)"
    ></canvas>
    <span
      class={[styles.handle, styles.start]}
      style:left={inside(startPos)}
      style:visibility={visible(startPos)}
      role="slider"
      tabindex={disabled ? -1 : 0}
      aria-label={$_('export_range_start')}
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={s}
      aria-valuetext={seconds(s)}
      aria-disabled={disabled || undefined}
      data-target="start"
      onkeydown={onKeydown('start')}
    ></span>
    <span
      class={[styles.handle, styles.end]}
      style:left={inside(endPos)}
      style:visibility={visible(endPos)}
      role="slider"
      tabindex={disabled ? -1 : 0}
      aria-label={$_('export_range_end')}
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={e}
      aria-valuetext={seconds(e)}
      aria-disabled={disabled || undefined}
      data-target="end"
      onkeydown={onKeydown('end')}
    ></span>
    <span
      class={styles.playhead}
      bind:this={playhead}
      style:left={inside(currentPos)}
      style:visibility={visible(currentPos)}
      role="slider"
      tabindex={disabled ? -1 : 0}
      aria-label={$_('audio_seek')}
      aria-valuemin={s}
      aria-valuemax={e}
      aria-valuenow={current}
      aria-valuetext="{format(current - s)} / {format(e - s)}"
      aria-disabled={disabled || undefined}
      data-target="playhead"
      onkeydown={onKeydown('playhead')}
    ></span>
  </div>
</div>
