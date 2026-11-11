<script lang="ts">
	// ドット絵風の再生プレイヤー。ブラウザの audio のコントロールは見た目を変えられないため、
	// <audio> は見せずに置き、再生・時間・シーク・ミュート・音量を自前で作る。
	// シークバーは書き出しの範囲の設定を兼ね（TrimBar）、再生と時間の表示も範囲の中で行う。
	// 書き出しの処理も JS から再生・シーク・一時停止するため、bind:paused などの双方向のバインドは使わない
	// （画面側の値が audio を操作し返して、書き出しの再生を止めたりシークを戻したりしうる）。
	// audio の状態はイベントで読むだけにし、操作は押したときにだけ audio に直接する
	import { onDestroy } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { clamp } from '#lib/util.ts';
	import TrimBar from './trimBar.svelte';

	// 親（AudioUploader・書き出し）が使う audio 要素と、曲の長さ（秒。読み込む前は 0）
	export let audio: HTMLAudioElement | null = null;
	export let duration = 0;
	// 書き出しの範囲（秒）
	export let rangeStart: number;
	export let rangeEnd: number;
	// 録画中など、操作させたくないとき true
	export let locked = false;

	let currentTime = 0;
	let mediaDuration = NaN;
	let paused = true;
	let volume = 1;
	let muted = false;

	$: duration = Number.isFinite(mediaDuration) ? mediaDuration : 0;
	// 数値の入力欄から範囲外や逆転した値が入っても、再生と表示が崩れないようにする
	$: start = clamp(rangeStart, 0, duration);
	$: end = clamp(rangeEnd, start, duration);

	// 再生中は timeupdate（4 回/秒ほど）だけでは表示がかくつくため、毎フレーム読む。
	// 範囲の終わりまで来たら止める（録画中は書き出しの処理が止める）。
	// 範囲の頭へ戻して再生した直後、Safari はシークが済むまで元の位置を返すことがあるため、シーク中は見ない。
	// ハンドルをドラッグしているあいだも見ない（終わりのハンドルが再生位置を横切っても止めない）
	// ハンドルをドラッグしているか
	let trimming = false;
	let frame = 0;
	const follow = () => {
		if (!audio) return;
		currentTime = audio.currentTime;
		if (!locked && !trimming && !audio.paused && !audio.seeking && currentTime >= end)
			audio.pause();
		if (!audio.paused) frame = requestAnimationFrame(follow);
	};
	const readState = () => {
		if (!audio) return;
		mediaDuration = audio.duration;
		currentTime = audio.currentTime;
		paused = audio.paused;
		volume = audio.volume;
		muted = audio.muted;
	};
	// サーバーでの描画（ビルド時の HTML の生成）でも呼ばれ、そこには cancelAnimationFrame が無い
	onDestroy(() => frame && cancelAnimationFrame(frame));
	$: ready = duration > 0;

	// 再生位置を範囲の中へ移す。
	// 曲の長さちょうどへシークすると、Firefox は読み込みが止まり、その後の再生（書き出しも）が進まなくなる。
	// 最後まで送っても、ほんの少し手前で止める
	const seek = (t: number) => {
		if (!audio) return;
		audio.currentTime = Math.min(clamp(t, start, end), Math.max(0, duration - 0.05));
		currentTime = audio.currentTime;
	};

	// 範囲が変わって再生位置が外に出たら、範囲の中へ戻す。止まっているときは近い方の端へ、
	// 再生中は範囲の頭へ戻して再生を続ける（終わりの端へ戻すと、そこですぐ止まってしまう）。
	// ハンドルをドラッグしているあいだは戻さない（再生位置に吸着させるため、再生位置は動かさない）
	const keepInRange = (start: number, end: number) => {
		if (!audio || !ready || trimming || locked) return;
		if (currentTime < start || currentTime > end) seek(audio.paused ? currentTime : start);
	};
	$: keepInRange(start, end);

	const toggle = () => {
		if (!audio || !ready) return;
		if (audio.paused) {
			// 範囲の外や終わりにいるときは、範囲の頭から再生する
			if (audio.currentTime < start || audio.currentTime >= Math.min(end, duration - 0.05)) {
				seek(start);
			}
			audio.play().catch((error) => console.error(error));
		} else audio.pause();
	};

	const format = (t: number) => {
		const s = Number.isFinite(t) ? Math.max(0, Math.floor(t)) : 0;
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	};
</script>

<!-- inert に対応していないブラウザ（Firefox 111 以前）のため、locked のときはマウス操作も CSS で止める -->
<div class="audio-player" class:locked inert={locked || undefined}>
	<audio
		bind:this={audio}
		on:loadedmetadata={readState}
		on:durationchange={readState}
		on:emptied={readState}
		on:timeupdate={readState}
		on:seeked={readState}
		on:volumechange={readState}
		on:pause={readState}
		on:ended={readState}
		on:play={() => {
			readState();
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(follow);
		}}
	></audio>
	<TrimBar
		{duration}
		bind:start={rangeStart}
		bind:end={rangeEnd}
		current={currentTime}
		disabled={!ready}
		on:seek={(e) => seek(e.detail)}
		on:trimstart={() => (trimming = true)}
		on:trimend={() => {
			trimming = false;
			keepInRange(start, end);
		}}
	/>
	<div class="audio-player-controls">
		<button
			type="button"
			class="pixel-button audio-player-button"
			aria-label={paused ? $_('audio_play') : $_('audio_pause')}
			disabled={!ready}
			on:click={toggle}
		>
			<span class={paused ? 'icon-play' : 'icon-pause'} aria-hidden="true"></span>
		</button>
		<!-- 時間は範囲の頭からの位置と、範囲の長さで示す -->
		<span class="audio-player-time"
			>{format(clamp(currentTime, start, end) - start)} / {format(end - start)}</span
		>
		<button
			type="button"
			class="pixel-button audio-player-button audio-player-mute"
			aria-label={$_('audio_mute')}
			aria-pressed={muted}
			on:click={() => audio && (audio.muted = !audio.muted)}
		>
			<span class="icon-speaker" aria-hidden="true"></span>
			<span class={muted ? 'icon-muted' : 'icon-waves'} aria-hidden="true"></span>
		</button>
		<input
			type="range"
			class="pixel-range audio-player-volume"
			min="0"
			max="1"
			step="0.05"
			value={volume}
			aria-label={$_('audio_volume')}
			on:input={(e) => {
				if (!audio) return;
				audio.volume = Number(e.currentTarget.value);
				audio.muted = false;
			}}
			style:--progress="{muted ? 0 : volume * 100}%"
		/>
	</div>
</div>
