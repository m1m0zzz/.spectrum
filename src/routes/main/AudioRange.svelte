<script lang="ts">
  import styles from './AudioRange.module.css';
  // 書き出す範囲。範囲指定付きのシークバー（TrimBar。中に波形を描く）と、秒の入力欄を並べる。
  // 曲の長さ・再生位置・波形は AudioState から読み、範囲は ExportState に書く。
  // バーでのシークは範囲の中で AudioState に頼み、ハンドルをドラッグしているあいだは rangeEditing を立てる
  import { _ } from 'svelte-i18n';
  import PixelNumber from '#lib/components/PixelNumber.svelte';
  import TrimBar from '#lib/components/TrimBar.svelte';
  import { clamp } from '#lib/util.ts';
  import { getAudioState } from '#lib/state/audio.svelte.ts';
  import { getExportState } from '#lib/state/export.svelte.ts';

  const audio = getAudioState();
  const exporter = getExportState();
  // 動画の作成中は範囲を変えられないようにする
  const disabled = $derived(exporter.busy);
</script>

<div class={styles.root}>
  <!-- マウスストーカー（Mouse.svelte）が、範囲のバーの上で大きくなるようにする -->
  <TrimBar
    data-stalker-target
    duration={audio.duration}
    bind:start={exporter.rangeStart}
    bind:end={exporter.rangeEnd}
    current={audio.currentTime}
    waveform={audio.waveform}
    disabled={audio.duration <= 0 || disabled}
    onseek={(time) => audio.seek(clamp(time, exporter.rangeStart, exporter.rangeEnd))}
    ontrimstart={() => (exporter.rangeEditing = true)}
    ontrimend={() => (exporter.rangeEditing = false)}
  />
  <p>
    <PixelNumber>
      <input
        type="number"
        min="0"
        max={audio.duration}
        step="0.1"
        bind:value={exporter.rangeStart}
        aria-label={$_('export_range_start')}
        {disabled}
      />
    </PixelNumber>
    <span>〜</span>
    <PixelNumber>
      <input
        type="number"
        min="0"
        max={audio.duration}
        step="0.1"
        bind:value={exporter.rangeEnd}
        aria-label={$_('export_range_end')}
        {disabled}
      />
    </PixelNumber>
    <span>{$_('export_range_seconds')}</span>
  </p>
  {#if exporter.rangeError}
    <p class="error">{$_('export_range_error')}</p>
  {/if}
</div>
