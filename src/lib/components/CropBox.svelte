<script lang="ts">
  import styles from './CropBox.module.css';
  // 画像のプレビューに重ねる、トリミングの枠。枠の内側をつかむと動かし、辺と角のハンドルで大きさを変える。
  // Pointer Events で扱うので、マウスとタッチのどちらでも操作できる。
  // 枠にフォーカスすると、矢印キーで動かし、Shift + 矢印キーで大きさを変えられる
  import type { HTMLAttributes } from 'svelte/elements';
  import { _ } from 'svelte-i18n';
  import { dragRect, sameRect, type Handle, type Rect } from '#lib/crop.ts';

  type Props = {
    // 元の画像の大きさ（px）と、トリミングの範囲（元の画像の px）
    width: number;
    height: number;
    rect: Rect;
    disabled?: boolean;
    // 範囲を動かし終えたとき（ドラッグを離したとき・キーで動かしたとき）に呼ぶ
    onchange?: (rect: Rect) => void;
  } & Omit<HTMLAttributes<HTMLDivElement>, 'onchange'>;
  // ほかの属性（data-* など）は rest に入れ、いちばん外の要素に付ける
  let { width, height, rect = $bindable(), disabled = false, onchange, ...rest }: Props = $props();

  // 縦横比に吸着させる距離と、範囲の最小の大きさ（画面上の px）
  const SNAP_PX = 8;
  const MIN_PX = 40;
  // 辺のハンドルを先に置き、重なったときは角のハンドルを上にする
  const HANDLES = ['n', 'e', 's', 'w', 'nw', 'ne', 'se', 'sw'] as const;

  let layer: HTMLElement | undefined = $state();
  let frame: HTMLElement | undefined = $state();

  // 画面上の 1px にあたる、元の画像の px
  const scale = () => width / (layer?.getBoundingClientRect().width ?? width);
  const options = () => ({ minSize: MIN_PX * scale(), snap: SNAP_PX * scale() });

  const percent = (value: number, length: number) => `${(value / length) * 100}%`;

  // ドラッグ。押したときの範囲と位置からの差で動かす（動かすたびに丸めた範囲から足すと、ずれがたまるため）
  let dragging: Handle | null = null;
  let pointerId = -1;
  let startRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  let startX = 0;
  let startY = 0;

  const onPointerDown = (event: PointerEvent) => {
    // 2 本目の指は無視する
    if (disabled || dragging || event.button != 0) return;
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-handle]');
    dragging = (el?.dataset.handle ?? 'move') as Handle;
    pointerId = event.pointerId;
    startRect = rect;
    startX = event.clientX;
    startY = event.clientY;
    event.preventDefault();
    frame?.focus({ preventScroll: true });
    frame?.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!dragging || event.pointerId != pointerId) return;
    const s = scale();
    rect = dragRect(
      startRect,
      dragging,
      (event.clientX - startX) * s,
      (event.clientY - startY) * s,
      { width, height },
      options()
    );
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!dragging || event.pointerId != pointerId) return;
    dragging = null;
    if (!sameRect(rect, startRect)) onchange?.(rect);
  };

  // キーボード。画像の幅の 1% ずつ（小さい画像では 1px ずつ）動かす
  const onKeydown = (event: KeyboardEvent) => {
    const direction = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    }[event.key];
    if (!direction || disabled) return;
    event.preventDefault();
    const step = Math.max(1, Math.round(width / 100));
    const next = dragRect(
      rect,
      event.shiftKey ? 'se' : 'move',
      direction[0] * step,
      direction[1] * step,
      { width, height },
      { minSize: options().minSize }
    );
    if (sameRect(next, rect)) return;
    rect = next;
    onchange?.(rect);
  };
</script>

<!-- 使う側が渡したほかの属性（data-* など）は、いちばん外の要素に付ける。
     この要素はマウスを受けない（pointer-events: none）ため、カーソルの下の要素から closest() でたどると、枠の上でだけ見つかる -->
<div {...rest} class={[styles.layer, disabled && styles.disabled]} bind:this={layer}>
  <!-- 範囲の外を暗くする。範囲と同じ位置に置いた要素の影で覆い、はみ出た影は切る -->
  <div class={styles.shade}>
    <div
      style:left={percent(rect.x, width)}
      style:top={percent(rect.y, height)}
      style:width={percent(rect.width, width)}
      style:height={percent(rect.height, height)}
    ></div>
  </div>
  <!-- 枠は動かす・大きさを変える独自の操作を持つため role="application" にする。
       Svelte はこの role を操作できない要素とみなして警告するため、その警告だけを止める -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class={styles.frame}
    bind:this={frame}
    style:left={percent(rect.x, width)}
    style:top={percent(rect.y, height)}
    style:width={percent(rect.width, width)}
    style:height={percent(rect.height, height)}
    role="application"
    tabindex={disabled ? -1 : 0}
    aria-label={$_('crop_area')}
    aria-disabled={disabled || undefined}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    onkeydown={onKeydown}
  >
    {#each HANDLES as handle (handle)}
      <span class={[styles.handle, styles[handle]]} data-handle={handle}></span>
    {/each}
  </div>
</div>
