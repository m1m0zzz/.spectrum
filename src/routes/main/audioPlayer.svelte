<script lang="ts">
	// ドット絵風の再生プレイヤー。ブラウザの audio のコントロールは見た目を変えられないため、
	// <audio> は見せずに置き、再生・時間・シーク・ミュート・音量を自前で作る。
	// 書き出しの処理も JS から再生・シーク・一時停止するため、bind:paused などの双方向のバインドは使わない
	// （画面側の値が audio を操作し返して、書き出しの再生を止めたりシークを戻したりしうる）。
	// audio の状態はイベントで読むだけにし、操作は押したときにだけ audio に直接する
	import { onDestroy } from 'svelte';
	import { _ } from 'svelte-i18n';

	// 親（AudioUploader・書き出し）が使う audio 要素と、曲の長さ（秒。読み込む前は 0）
	export let audio: HTMLAudioElement | null = null;
	export let duration = 0;
	// 録画中など、操作させたくないとき true
	export let locked = false;

	let currentTime = 0;
	let mediaDuration = NaN;
	let paused = true;
	let volume = 1;
	let muted = false;

	$: duration = Number.isFinite(mediaDuration) ? mediaDuration : 0;

	// 再生中は timeupdate（4 回/秒ほど）だけでは表示がかくつくため、毎フレーム読む
	let frame = 0;
	const follow = () => {
		if (!audio) return;
		currentTime = audio.currentTime;
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
	$: progress = ready ? (currentTime / duration) * 100 : 0;

	const format = (t: number) => {
		const s = Number.isFinite(t) ? Math.max(0, Math.floor(t)) : 0;
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	};

	const toggle = () => {
		if (!audio || !ready) return;
		if (audio.paused) audio.play().catch((error) => console.error(error));
		else audio.pause();
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
	<button
		type="button"
		class="pixel-button audio-player-button"
		aria-label={paused ? $_('audio_play') : $_('audio_pause')}
		disabled={!ready}
		on:click={toggle}
	>
		<span class={paused ? 'icon-play' : 'icon-pause'} aria-hidden="true"></span>
	</button>
	<span class="audio-player-time">{format(currentTime)} / {format(duration)}</span>
	<input
		type="range"
		class="pixel-range audio-player-seek"
		min="0"
		max={duration}
		step="0.01"
		value={currentTime}
		disabled={!ready}
		aria-label={$_('audio_seek')}
		aria-valuetext="{format(currentTime)} / {format(duration)}"
		style:--progress="{progress}%"
		on:input={(e) => {
			if (!audio) return;
			// 曲の長さちょうどへシークすると、Firefox は読み込みが止まり、その後の再生（書き出しも）が進まなくなる。
			// 最後まで送っても、ほんの少し手前で止める
			audio.currentTime = Math.min(Number(e.currentTarget.value), Math.max(0, duration - 0.05));
			currentTime = audio.currentTime;
		}}
	/>
	<button
		type="button"
		class="pixel-button audio-player-button"
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
