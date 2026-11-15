<script lang="ts">
  import { _ } from 'svelte-i18n';
  import PixelSelect from './pixelSelect.svelte';
  import {
    audioBitrates,
    exportMethods,
    frameRates,
    qualities,
    speeds,
    videoFormats,
    type EncodeSettings
  } from '#lib/encode.ts';

  // 書き出す範囲は、ファイルタブの音声の下（audioRange.svelte）で決める
  export let settings: EncodeSettings;
  // 書き出し中は設定を変えられないようにする
  export let busy: boolean;

  $: methodOptions = exportMethods.map((v) => ({ value: v, label: $_(`export_method_${v}`) }));
  $: formatOptions = videoFormats.map((v) => ({ value: v, label: $_(`export_format_${v}`) }));
  $: qualityOptions = qualities.map((v) => ({ value: v, label: $_(`export_quality_${v}`) }));
  $: speedOptions = speeds.map((v) => ({ value: v, label: $_(`export_speed_${v}`) }));
  const fpsOptions = frameRates.map((v) => ({ value: v as number, label: `${v} fps` }));
  const bitrateOptions = audioBitrates.map((v) => ({ value: v as number, label: `${v} kbps` }));
</script>

<section>
  <p>
    <span id="export-method-label">{$_('export_method')}</span>
    <PixelSelect
      id="export-method"
      labelledby="export-method-label"
      options={methodOptions}
      bind:value={settings.method}
      disabled={busy}
    />
  </p>
  <p>
    <span id="export-format-label">{$_('export_format')}</span>
    <PixelSelect
      id="export-format"
      labelledby="export-format-label"
      options={formatOptions}
      bind:value={settings.format}
      disabled={busy}
    />
  </p>
  <p>
    <span id="export-quality-label">{$_('export_quality')}</span>
    <PixelSelect
      id="export-quality"
      labelledby="export-quality-label"
      options={qualityOptions}
      bind:value={settings.quality}
      disabled={busy}
    />
  </p>
  <!-- 変換速度は ffmpeg で映像をエンコードするときの設定。高速書き出しは WebCodecs でエンコードするため使わない -->
  <p hidden={settings.method == 'fast'}>
    <span id="export-speed-label">{$_('export_speed')}</span>
    <PixelSelect
      id="export-speed"
      labelledby="export-speed-label"
      options={speedOptions}
      bind:value={settings.speed}
      disabled={busy}
    />
  </p>
  <p>
    <span id="export-fps-label">{$_('export_fps')}</span>
    <PixelSelect
      id="export-fps"
      labelledby="export-fps-label"
      options={fpsOptions}
      bind:value={settings.fps}
      disabled={busy}
    />
  </p>
  <p>
    <span id="export-audio-bitrate-label">{$_('export_audio_bitrate')}</span>
    <PixelSelect
      id="export-audio-bitrate"
      labelledby="export-audio-bitrate-label"
      options={bitrateOptions}
      bind:value={settings.audioBitrate}
      disabled={busy}
    />
  </p>
</section>
