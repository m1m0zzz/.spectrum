<script lang="ts">
  import styles from './AudioRange.module.css';
  // 書き出す範囲。範囲指定付きのシークバー（TrimBar。中に波形を描く）と、秒の入力欄を並べる。
  // 再生位置とシークは再生プレイヤー（AudioPlayer）が持つため、シークとハンドルの操作はイベントで親に返す
  import { createEventDispatcher } from 'svelte';
  import { _ } from 'svelte-i18n';
  import PixelNumber from '#lib/components/PixelNumber.svelte';
  import TrimBar from '#lib/components/TrimBar.svelte';

  // 曲の長さ（秒。読み込む前は 0）と範囲（秒）、再生位置（秒）
  export let duration: number;
  export let rangeStart: number;
  export let rangeEnd: number;
  export let current: number;
  // 曲を読み込んだうえで範囲が正しくないとき true
  export let rangeError: boolean;
  export let waveform: Float32Array | null = null;
  // 動画の作成中は範囲を変えられないようにする
  export let disabled = false;

  const dispatch = createEventDispatcher<{ seek: number; trimstart: void; trimend: void }>();
</script>

<div class={styles.root}>
  <!-- マウスストーカー（Mouse.svelte）が、範囲のバーの上で大きくなるようにする -->
  <TrimBar
    data-stalker-target
    {duration}
    bind:start={rangeStart}
    bind:end={rangeEnd}
    {current}
    {waveform}
    disabled={duration <= 0 || disabled}
    on:seek={(e) => dispatch('seek', e.detail)}
    on:trimstart={() => dispatch('trimstart')}
    on:trimend={() => dispatch('trimend')}
  />
  <p>
    <PixelNumber>
      <input
        type="number"
        min="0"
        max={duration}
        step="0.1"
        bind:value={rangeStart}
        aria-label={$_('export_range_start')}
        {disabled}
      />
    </PixelNumber>
    <span>〜</span>
    <PixelNumber>
      <input
        type="number"
        min="0"
        max={duration}
        step="0.1"
        bind:value={rangeEnd}
        aria-label={$_('export_range_end')}
        {disabled}
      />
    </PixelNumber>
    <span>{$_('export_range_seconds')}</span>
  </p>
  {#if rangeError}
    <p class="error">{$_('export_range_error')}</p>
  {/if}
</div>
