<script lang="ts">
  import styles from './AudioPlayer.module.css';
  // ドット絵風の再生プレイヤー。ブラウザの audio のコントロールは見た目を変えられないため、
  // 再生・時間・シーク・ミュート・音量を自前で作る。曲と再生の状態（AudioState）を受け取り、表示と操作だけをする。
  // 範囲（start〜end）を渡すと、再生・シーク・時間の表示をその中で行う。シークバーは範囲の頭から終わりまでの、ふつうのスライダー。
  // 書き出しの処理も JS から再生・シーク・一時停止するため、状態は読むだけにし、操作は押したときにだけ AudioState を通して行う
  import { untrack } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { clamp, formatTime } from '#lib/util.ts';
  import type { AudioState } from '#lib/state/audio.svelte.ts';

  type Props = {
    player: AudioState;
    // 再生する範囲（秒）。省略すると曲全体
    start?: number;
    end?: number;
    // 操作させたくないとき（動画の作成中など）true。範囲の端で止めたり、範囲の中へ戻したりもしない
    disabled?: boolean;
    // 範囲の端で止めたり、範囲の中へ戻したりしないとき true（範囲を動かしている最中など）。
    // false に戻したときに、再生位置が範囲の外なら中へ戻す
    ignoreRange?: boolean;
  };
  let {
    player,
    start = 0,
    end = Infinity,
    disabled = false,
    ignoreRange = false
  }: Props = $props();

  // 数値の入力欄から範囲外や逆転した値が入っても、再生と表示が崩れないようにする
  const s = $derived(clamp(start, 0, player.duration));
  const e = $derived(clamp(end, s, player.duration));
  const position = $derived(clamp(player.currentTime, s, e) - s);

  const seek = (t: number) => player.seek(clamp(t, s, e));

  // 範囲の終わりまで来たら止める（作成中は書き出しの処理が止める）。
  // 範囲の頭へ戻して再生した直後、Safari はシークが済むまで元の位置を返すことがあるため、シーク中は見ない
  $effect(() => {
    if (disabled || ignoreRange || player.paused || player.seeking) return;
    if (player.currentTime >= e) player.pause();
  });

  // 範囲が変わって再生位置が外に出たら、範囲の中へ戻す。止まっているときは近い方の端へ、
  // 再生中は範囲の頭へ戻して再生を続ける（終わりの端へ戻すと、そこですぐ止まってしまう）。
  // 範囲を動かしているあいだ（ignoreRange）は戻さず、終えたときに戻す。再生位置が動くたびには見ない
  $effect(() => {
    const [from, to] = [s, e];
    if (ignoreRange) return;
    untrack(() => {
      if (!player.ready || disabled) return;
      const t = player.currentTime;
      if (t < from || t > to) seek(player.paused ? t : from);
    });
  });

  const toggle = () => {
    if (!player.ready) return;
    if (player.paused) {
      // 範囲の外や終わりにいるときは、範囲の頭から再生する
      const t = player.currentTime;
      if (t < s || t >= Math.min(e, player.duration - 0.05)) seek(s);
      player.play().catch((error) => console.error(error));
    } else player.pause();
  };
</script>

<div class={styles.root}>
  <input
    type="range"
    class={['pixel-range', styles.seek]}
    min="0"
    max={e - s}
    step="any"
    value={position}
    aria-label={$_('audio_seek')}
    aria-valuetext="{formatTime(position)} / {formatTime(e - s)}"
    disabled={!player.ready || disabled}
    oninput={(event) => seek(s + Number(event.currentTarget.value))}
    style:--progress="{e > s ? (position / (e - s)) * 100 : 0}%"
  />
  <div class={styles.controls}>
    <button
      type="button"
      class={['pixel-button', styles.button]}
      aria-label={player.paused ? $_('audio_play') : $_('audio_pause')}
      disabled={!player.ready || disabled}
      onclick={toggle}
    >
      <span class={player.paused ? styles.iconPlay : styles.iconPause} aria-hidden="true"></span>
    </button>
    <span class={styles.time}>{formatTime(position)} / {formatTime(e - s)}</span>
    <button
      type="button"
      class={['pixel-button', styles.button, styles.mute]}
      aria-label={$_('audio_mute')}
      aria-pressed={player.muted}
      {disabled}
      onclick={() => player.setMuted(!player.muted)}
    >
      <span class={styles.iconSpeaker} aria-hidden="true"></span>
      <span class={player.muted ? styles.iconMuted : styles.iconWaves} aria-hidden="true"></span>
    </button>
    <input
      type="range"
      class={['pixel-range', styles.volume]}
      min="0"
      max="1"
      step="0.05"
      value={player.volume}
      aria-label={$_('audio_volume')}
      {disabled}
      oninput={(event) => player.setVolume(Number(event.currentTarget.value))}
      style:--progress="{player.muted ? 0 : player.volume * 100}%"
    />
  </div>
</div>
