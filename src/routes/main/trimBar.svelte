<script lang="ts">
	// スマホの動画編集アプリのような、範囲（開始・終了）と再生位置をまとめて操作するバー。
	// 範囲の外は点線の枠だけにし、範囲は枠で囲んで、左右のハンドルで伸び縮みさせる。再生位置は白い縦棒で示す。
	// ハンドルと縦棒はそれぞれ role="slider" にし、キーボードでも動かせるようにする。
	// 範囲の中には、曲の波形を白いドットで描く
	import { createEventDispatcher } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { clamp } from '#lib/util.ts';
	import { resamplePeaks } from '#lib/waveform.ts';

	// 曲の長さ（秒）と、範囲・再生位置（秒）
	export let duration: number;
	export let start: number;
	export let end: number;
	export let current: number;
	export let disabled = false;
	// 波形（区間ごとの振幅の最大。computePeaks の結果）。読み込む前やデコードできなかったときは null
	export let waveform: Float32Array | null = null;

	const dispatch = createEventDispatcher<{
		// 再生位置を動かした（範囲内に収めた秒）
		seek: number;
		// 範囲を動かし始めた・動かし終えた
		trimstart: void;
		trimend: void;
	}>();

	// 範囲の最短の長さ（秒）
	const MIN_LENGTH = 0.1;
	// ハンドルが再生位置にこれより近づいたら（px）、再生位置に吸着させる
	const SNAP_PX = 8;

	let track: HTMLElement;
	let playhead: HTMLElement;
	let wave: HTMLCanvasElement;
	let trackWidth = 0;

	// 波形を、1 ドットを 1 画素とした canvas に描き、帯いっぱいに拡大して見せる。
	// 帯の高さ 22 ドットのうち、上下 1 ドットは枠なので、真ん中の 20 ドットに、中央から上下対称の棒を立てる。
	// 棒の高さは曲の中でいちばん大きい音を 20 ドットとし、2・4・…・20 ドットの 10 段にする
	const WAVE_ROWS = 22;
	const drawWave = (canvas: HTMLCanvasElement, peaks: Float32Array | null, width: number) => {
		if (!canvas) return;
		const dot = parseFloat(getComputedStyle(canvas).getPropertyValue('--dot')) || 3;
		const columns = Math.max(1, Math.round(width / dot));
		canvas.width = columns;
		canvas.height = WAVE_ROWS;
		const ctx = canvas.getContext('2d');
		if (!ctx || !peaks) return;
		const values = resamplePeaks(peaks, columns);
		const max = values.reduce((a, b) => Math.max(a, b), 0);
		if (max <= 0) return;
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
	$: drawWave(wave, waveform, trackWidth);

	// 数値の入力欄から範囲外や逆転した値が入っても、表示が崩れないようにする
	$: s = clamp(start, 0, duration);
	$: e = clamp(end, s, duration);
	// バーの左端からの位置（%）
	const ratio = (t: number, length: number) => (length > 0 ? clamp(t / length, 0, 1) * 100 : 0);
	$: startPos = ratio(s, duration);
	$: endPos = ratio(e, duration);
	$: currentPos = ratio(current, duration);

	// 入力欄に出す値。0.01 秒に丸める
	const round = (t: number) => Math.round(t * 100) / 100;

	// バーの外も含めた、横位置にあたる秒（つかんだ位置のずれを正しくとるため、ここでは端で止めない）
	const timeAt = (clientX: number) => {
		const rect = track.getBoundingClientRect();
		return ((clientX - rect.left) / rect.width) * duration;
	};
	const pxPerSecond = () => track.getBoundingClientRect().width / duration;
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
	const seek = (t: number) => dispatch('seek', clamp(t, s, e));

	// ドラッグ。押した位置とハンドル・縦棒の位置のずれを保ち、つかんだところから動かす
	type Target = 'start' | 'end' | 'playhead';
	let dragging: Target | null = null;
	let offset = 0;
	const onPointerDown = (event: PointerEvent) => {
		if (disabled || duration <= 0 || event.button != 0) return;
		const el = (event.target as HTMLElement).closest<HTMLElement>('[data-target]');
		const target = (el?.dataset.target ?? 'playhead') as Target;
		const at = timeAt(event.clientX);
		// 縦棒の外（バーの空いたところ）を押したときは、そこへ再生位置を移す
		offset = el ? at - { start: s, end: e, playhead: current }[target] : 0;
		dragging = target;
		event.preventDefault();
		(el ?? playhead).focus();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		if (target == 'playhead') {
			if (!el) seek(at);
		} else dispatch('trimstart');
	};
	const onPointerMove = (event: PointerEvent) => {
		if (!dragging) return;
		const t = timeAt(event.clientX) - offset;
		if (dragging == 'start') moveStart(t, true);
		else if (dragging == 'end') moveEnd(t, true);
		else seek(t);
	};
	const onPointerUp = () => {
		if (dragging && dragging != 'playhead') dispatch('trimend');
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
		if (target != 'playhead') dispatch('trimend');
	};

	const seconds = (t: number) => $_('export_range_value', { values: { value: t.toFixed(1) } });
	const format = (t: number) => {
		const sec = Number.isFinite(t) ? Math.max(0, Math.floor(t)) : 0;
		return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
	};
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="trim-bar"
	class:disabled
	class:dragging={dragging != null}
	on:pointerdown={onPointerDown}
	on:pointermove={onPointerMove}
	on:pointerup={onPointerUp}
	on:pointercancel={onPointerUp}
>
	<div class="trim-bar-track" bind:this={track} bind:clientWidth={trackWidth}>
		<span class="trim-bar-frame" style:left="{startPos}%" style:width="{endPos - startPos}%"></span>
		<!-- 波形は範囲の中だけを見せる。範囲を動かすたびに描き直さないよう、範囲の外を切り抜いて隠す -->
		<canvas
			class="trim-bar-wave"
			bind:this={wave}
			aria-hidden="true"
			style:clip-path="inset(0 {100 - endPos}% 0 {startPos}%)"
		></canvas>
		<span
			class="trim-bar-handle start"
			style:left="{startPos}%"
			role="slider"
			tabindex={disabled ? -1 : 0}
			aria-label={$_('export_range_start')}
			aria-valuemin={0}
			aria-valuemax={duration}
			aria-valuenow={s}
			aria-valuetext={seconds(s)}
			aria-disabled={disabled || undefined}
			data-target="start"
			on:keydown={onKeydown('start')}
		></span>
		<span
			class="trim-bar-handle end"
			style:left="{endPos}%"
			role="slider"
			tabindex={disabled ? -1 : 0}
			aria-label={$_('export_range_end')}
			aria-valuemin={0}
			aria-valuemax={duration}
			aria-valuenow={e}
			aria-valuetext={seconds(e)}
			aria-disabled={disabled || undefined}
			data-target="end"
			on:keydown={onKeydown('end')}
		></span>
		<span
			class="trim-bar-playhead"
			bind:this={playhead}
			style:left="{currentPos}%"
			role="slider"
			tabindex={disabled ? -1 : 0}
			aria-label={$_('audio_seek')}
			aria-valuemin={s}
			aria-valuemax={e}
			aria-valuenow={current}
			aria-valuetext="{format(current - s)} / {format(e - s)}"
			aria-disabled={disabled || undefined}
			data-target="playhead"
			on:keydown={onKeydown('playhead')}
		></span>
	</div>
</div>
