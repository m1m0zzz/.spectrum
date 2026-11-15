<script lang="ts">
  import styles from './AudioPlayer.module.css';
  // ドット絵風の再生プレイヤー。ブラウザの audio のコントロールは見た目を変えられないため、
  // <audio> は見せずに置き、再生・時間・シーク・ミュート・音量を自前で作る。
  // 再生・シーク・時間の表示は、書き出しの範囲（ファイルタブの TrimBar で決める）の中で行う。
  // シークバーは範囲の頭から終わりまでの、ふつうのスライダー。
  // 再生位置（currentTime）とシーク（seek）は、ファイルタブの TrimBar からも使う。
  // 書き出しの処理も JS から再生・シーク・一時停止するため、bind:paused などの双方向のバインドは使わない
  // （画面側の値が audio を操作し返して、書き出しの再生を止めたりシークを戻したりしうる）。
  // audio の状態はイベントで読むだけにし、操作は押したときにだけ audio に直接する
  import { onDestroy } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { clamp } from '#lib/util.ts';

  // 親（AudioUploader・書き出し）が使う audio 要素と、曲の長さ（秒。読み込む前は 0）
  export let audio: HTMLAudioElement | null = null;
  export let duration = 0;
  // 書き出しの範囲（秒）
  export let rangeStart: number;
  export let rangeEnd: number;
  // 動画の作成中など、操作させたくないとき true
  export let locked = false;
  // TrimBar のハンドルをドラッグしているか
  export let trimming = false;
  // 再生位置（秒）。親へは読み取り用に返す
  export let currentTime = 0;

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
  export const seek = (t: number) => {
    if (!audio) return;
    audio.currentTime = Math.min(clamp(t, start, end), Math.max(0, duration - 0.05));
    currentTime = audio.currentTime;
  };

  // 範囲が変わって再生位置が外に出たら、範囲の中へ戻す。止まっているときは近い方の端へ、
  // 再生中は範囲の頭へ戻して再生を続ける（終わりの端へ戻すと、そこですぐ止まってしまう）。
  // ハンドルをドラッグしているあいだは戻さない（再生位置に吸着させるため、再生位置は動かさない）。
  // ドラッグを終えたときに戻す
  const keepInRange = (start: number, end: number) => {
    if (!audio || !ready || trimming || locked) return;
    if (currentTime < start || currentTime > end) seek(audio.paused ? currentTime : start);
  };
  $: if (!trimming) keepInRange(start, end);

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

<div class={styles.root}>
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
  <input
    type="range"
    class={['pixel-range', styles.seek]}
    min="0"
    max={end - start}
    step="any"
    value={clamp(currentTime, start, end) - start}
    aria-label={$_('audio_seek')}
    aria-valuetext="{format(clamp(currentTime, start, end) - start)} / {format(end - start)}"
    disabled={!ready || locked}
    on:input={(e) => seek(start + Number(e.currentTarget.value))}
    style:--progress="{end > start
      ? ((clamp(currentTime, start, end) - start) / (end - start)) * 100
      : 0}%"
  />
  <div class={styles.controls}>
    <button
      type="button"
      class={['pixel-button', styles.button]}
      aria-label={paused ? $_('audio_play') : $_('audio_pause')}
      disabled={!ready || locked}
      on:click={toggle}
    >
      <span class={paused ? styles.iconPlay : styles.iconPause} aria-hidden="true"></span>
    </button>
    <!-- 時間は範囲の頭からの位置と、範囲の長さで示す -->
    <span class={styles.time}
      >{format(clamp(currentTime, start, end) - start)} / {format(end - start)}</span
    >
    <button
      type="button"
      class={['pixel-button', styles.button, styles.mute]}
      aria-label={$_('audio_mute')}
      aria-pressed={muted}
      disabled={locked}
      on:click={() => audio && (audio.muted = !audio.muted)}
    >
      <span class={styles.iconSpeaker} aria-hidden="true"></span>
      <span class={muted ? styles.iconMuted : styles.iconWaves} aria-hidden="true"></span>
    </button>
    <input
      type="range"
      class={['pixel-range', styles.volume]}
      min="0"
      max="1"
      step="0.05"
      value={volume}
      aria-label={$_('audio_volume')}
      disabled={locked}
      on:input={(e) => {
        if (!audio) return;
        audio.volume = Number(e.currentTarget.value);
        audio.muted = false;
      }}
      style:--progress="{muted ? 0 : volume * 100}%"
    />
  </div>
</div>
