<script lang="ts">
  import styles from './index.module.css';
  import { onDestroy } from 'svelte';
  import { _ } from 'svelte-i18n';
  import PixelNumber from '#lib/components/PixelNumber.svelte';
  import PixelSelect from '#lib/components/PixelSelect.svelte';
  import AudioPlayer from '#lib/components/AudioPlayer.svelte';

  import { clamp } from '#lib/util.ts';
  import { AudioState, setAudioState } from '#lib/state/audio.svelte.ts';
  import { ExportState, setExportState } from '#lib/state/export.svelte.ts';
  import { ImageState, setImageState } from '#lib/state/image.svelte.ts';
  import { SpectrumState, setSpectrumState } from '#lib/state/spectrum.svelte.ts';

  import ImageUploader from './ImageUploader.svelte';
  import AudioUploader from './AudioUploader.svelte';
  import AudioRange from './AudioRange.svelte';
  import PlayerCanvas from './PlayerCanvas.svelte';
  import PlayerMenu from './PlayerMenu.svelte';
  import ExportSettings from './ExportSettings.svelte';
  import SizeInput from './SizeInput.svelte';

  // ページの状態。役割ごとに分けて context で配り、使うコンポーネントがそれぞれ読み書きする
  // - audio: 曲・再生・解析（<audio>・AudioContext・波形・FFT のサイズ）
  // - image: スペクトラムに使う画像（トリミング・ドット化の後）
  // - spectrum: 見た目の設定（大きさ・背景・感度など）と、描く canvas
  // - exporter: 書き出しの設定・範囲・進み具合
  const audio = new AudioState();
  const image = new ImageState();
  const spectrum = new SpectrumState();
  const exporter = new ExportState(audio);
  setAudioState(audio);
  setImageState(image);
  setSpectrumState(spectrum);
  setExportState(exporter);
  onDestroy(() => audio.destroy());

  // 書き出す範囲は、曲が変わったら全体に戻す
  $effect.pre(() => exporter.resetRange(audio.duration));

  let showVersion = $state(false);
  // 対応するブラウザ。下限は Vite のビルドの対象（既定の baseline-widely-available）で、構文はこの版に合わせて出力される。
  // 使っている API もこの版までにそろう（プレビューの OffscreenCanvas の 2d は Safari 16.4・Firefox 105、
  // ffmpeg.wasm の module worker は Firefox 114）。
  // 標準（高速）の書き出しは WebCodecs と OfflineAudioContext の suspend() を使い、Firefox は suspend() が無いため
  // リアルタイムだけになる（offlineExport.ts の hasFastExportApis）
  const SUPPORTED_BROWSERS = [
    { name: 'Chrome', version: '111' },
    { name: 'Edge', version: '111' },
    { name: 'Opera', version: '97' },
    { name: 'Safari', version: '16.4' },
    { name: 'Firefox', version: '114', realtimeOnly: true }
  ];

  // 画像の 1 列ごとに別の周波数ビンを割り当てられない（ビンが足りない）サイズは選べなくする
  const FFT_SIZES = [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768];
  const fftAllowed = (size: number, width: number | undefined) =>
    width == null || size / 2 - 1 >= width;
  const fftOptions = $derived(
    FFT_SIZES.map((size) => ({
      value: size,
      label: String(size),
      disabled: !fftAllowed(size, image.data?.width)
    }))
  );
  // 画像が変わって今のサイズが選べなくなったら、選べるうちでいちばん小さいサイズに上げる
  $effect.pre(() => {
    const width = image.data?.width;
    if (fftAllowed(audio.fftSize, width)) return;
    const size = FFT_SIZES.find((s) => fftAllowed(s, width));
    if (size != null) audio.fftSize = size;
  });

  // タブ。切り替えても中身（読み込んだ画像や、入力中の値）を保つため、パネルは破棄せず hidden で隠す
  const tabs = ['file', 'settings', 'video'] as const;
  type Tab = (typeof tabs)[number];
  let activeTab: Tab = $state('file');
  const tabRefs: HTMLButtonElement[] = $state([]);

  // WAI-ARIA の tabs パターンに合わせ、左右・Home・End キーでタブを移る
  const onTabKeydown = (e: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next =
      e.key == 'ArrowRight'
        ? (index + 1) % tabs.length
        : e.key == 'ArrowLeft'
          ? (index + last) % tabs.length
          : e.key == 'Home'
            ? 0
            : e.key == 'End'
              ? last
              : null;
    if (next == null) return;
    e.preventDefault();
    activeTab = tabs[next];
    tabRefs[next]?.focus();
  };
</script>

<main class={styles.main}>
  <div class={styles.container}>
    <!-- キャンバスより上（使い方・タブ・再生プレイヤー）は、キャンバスとは別に中央に揃える（index.module.css の .controls） -->
    <div class={styles.controls}>
      <h2>{$_('usage')}</h2>
      <ol>
        <li>{$_('usage_1')}</li>
        <li>{$_('usage_2')}</li>
        <li>{$_('usage_3')}</li>
      </ol>
      <button class="no-button action-link" onclick={() => (showVersion = !showVersion)}>
        {$_('supported_version')}
      </button>
      {#if showVersion}
        <ul style="margin-top: 0.25rem;">
          {#each SUPPORTED_BROWSERS as { name, version, realtimeOnly } (name)}
            <li>
              {name}
              {version}+{#if realtimeOnly}
                {$_('supported_realtime_only')}{/if}
            </li>
          {/each}
        </ul>
      {/if}

      <!-- タブとパネルの幅は、いちばん広いパネルに合わせる（index.module.css の .tabView） -->
      <div class={styles.tabView}>
        <div class={styles.tabs} role="tablist">
          {#each tabs as tab, i (tab)}
            <button
              class={styles.tab}
              role="tab"
              id="tab-{tab}"
              aria-selected={activeTab == tab}
              aria-controls="tab-panel-{tab}"
              tabindex={activeTab == tab ? 0 : -1}
              bind:this={tabRefs[i]}
              onclick={() => (activeTab = tab)}
              onkeydown={(e) => onTabKeydown(e, i)}>{$_(`tab_${tab}`)}</button
            >
          {/each}
        </div>

        <div
          class={styles.tabPanel}
          role="tabpanel"
          id="tab-panel-file"
          aria-labelledby="tab-file"
          hidden={activeTab != 'file'}
        >
          <ImageUploader />
          <AudioUploader />
          {#if audio.duration > 0}
            <AudioRange />
          {/if}
        </div>

        <div
          class={styles.tabPanel}
          role="tabpanel"
          id="tab-panel-settings"
          aria-labelledby="tab-settings"
          hidden={activeTab != 'settings'}
        >
          <section>
            <div style:display="flex" style:flex-wrap="wrap">
              <SizeInput />
            </div>
            <p>
              <label
                >{$_('parameters_background')}
                <input type="color" bind:value={spectrum.background} disabled={exporter.busy} />
                <!-- TODO: text color input -->
                <!-- <input bind:value={background}> -->
              </label>
            </p>
            <p>
              <span id="fft-size-label">{$_('parameters_fft_size')}</span>
              <PixelSelect
                id="fft-size"
                labelledby="fft-size-label"
                options={fftOptions}
                bind:value={audio.fftSize}
                disabled={exporter.busy}
              />
            </p>
            <p>
              <label
                >{$_('parameters_sensitivity')}
                <PixelNumber>
                  <input
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.1"
                    disabled={exporter.busy}
                    bind:value={spectrum.sensitivity}
                    onchange={(e) =>
                      (spectrum.sensitivity = clamp(Number(e.currentTarget.value), 0.1, 10))}
                  />
                </PixelNumber>
              </label>
            </p>
            <p>
              <label
                >{$_('parameters_grid_size')}
                <PixelNumber>
                  <input
                    type="number"
                    min="0"
                    disabled={exporter.busy}
                    bind:value={spectrum.gridSize}
                    onchange={(e) =>
                      (spectrum.gridSize = Math.max(0, Number(e.currentTarget.value)))}
                  />
                </PixelNumber>
              </label>
              <span>px</span>
            </p>
            <p>
              <label
                >{$_('parameters_smooth')}
                <PixelNumber>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    disabled={exporter.busy}
                    bind:value={spectrum.smoothTime}
                    onchange={(e) =>
                      (spectrum.smoothTime = Math.max(0, Number(e.currentTarget.value)))}
                  />
                </PixelNumber>
              </label>
              <span>ms</span>
            </p>
            <p>
              <label
                >{$_('parameters_slope')}
                <PixelNumber>
                  <input
                    type="number"
                    min="-12"
                    max="12"
                    step="0.5"
                    disabled={exporter.busy}
                    bind:value={spectrum.slope}
                    onchange={(e) =>
                      (spectrum.slope = clamp(Number(e.currentTarget.value), -12, 12))}
                  />
                </PixelNumber>
              </label>
              <span>dB/oct</span>
            </p>
          </section>
        </div>

        <div
          class={styles.tabPanel}
          role="tabpanel"
          id="tab-panel-video"
          aria-labelledby="tab-video"
          hidden={activeTab != 'video'}
        >
          <ExportSettings />
        </div>
      </div>

      <!-- 再生プレイヤーは、どのタブを開いていても操作できるようタブの外に置き、音声を読み込む前から常に表示する。
           作成中は一時停止・シーク・音量で録画が止まる・ずれる・音が変わるため、操作できなくする -->
      <section>
        <AudioPlayer
          player={audio}
          start={exporter.rangeStart}
          end={exporter.rangeEnd}
          ignoreRange={exporter.rangeEditing}
          disabled={exporter.busy}
        />
      </section>
    </div>

    <PlayerCanvas />

    <PlayerMenu />
  </div>
</main>
