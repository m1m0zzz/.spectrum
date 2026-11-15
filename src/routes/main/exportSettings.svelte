<script lang="ts">
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import PixelSelect from './pixelSelect.svelte';
  import { detectFastFormats } from '#lib/offlineExport.ts';
  import {
    audioBitrates,
    exportMethods,
    frameRates,
    qualities,
    speeds,
    videoFormats,
    type EncodeSettings,
    type VideoFormat
  } from '#lib/encode.ts';

  // 書き出す範囲は、ファイルタブの音声の下（audioRange.svelte）で決める
  export let settings: EncodeSettings;
  // 書き出し中は設定を変えられないようにする
  export let busy: boolean;

  // 高速書き出しを使える形式。画面を開いたときに調べる（調べ終わるまでは null で、選べるままにする）
  let fastFormats: Set<VideoFormat> | null = null;
  onMount(async () => {
    fastFormats = await detectFastFormats(settings);
  });
  $: fastAvailable = fastFormats == null || fastFormats.has(settings.format);
  // 今の形式で使えないときは、リアルタイムに切り替える
  $: if (!fastAvailable && settings.method == 'fast') settings.method = 'realtime';

  $: methodOptions = exportMethods.map((v) =>
    v == 'fast' && !fastAvailable
      ? {
          value: v,
          // どの形式でも使えないときはブラウザ、ほかの形式なら使えるときは形式のせいだと示す
          label: $_(
            fastFormats?.size
              ? 'export_method_fast_unsupported_format'
              : 'export_method_fast_unsupported'
          ),
          disabled: true
        }
      : { value: v, label: $_(`export_method_${v}`) }
  );
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
