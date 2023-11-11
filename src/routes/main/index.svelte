<script lang="ts">
  import { _ } from "svelte-i18n";

	import { generateLogToPixelIndexMap, isSpectrumType, spectrumTypes, type LogToPixelIndexMap, type SpectrumType, capitalize, padding, clamp } from '$lib';

  import ImageUploader from './imageUploader.svelte';
  import AudioUploader from './audioUploader.svelte';
	import PlayerCanvas from './playerCanvas.svelte';
	import PlayerMenu from './playerMenu.svelte';
  import SizeInput from "./sizeInput.svelte";

  let imageLoaded = false;
  let imageData: ImageData;
  let memoAlpha: number[];
  let logToPixelIndexMap: LogToPixelIndexMap;
  let audioContext: AudioContext | null;
  let nodeAnalyser: AnalyserNode | null;
  let recorderDestination: MediaStreamAudioDestinationNode;

  // parameters
  let playerWidth = 320;
  let playerHeight = 320;
  let background = "#000000";
  let fftSize = 8192;
  let spectrumType: SpectrumType = "pixel";
  let spectrumSensitivity = 1;
  let spectrumGridSize = 0;
  let spectrumSmoothTime = 0;

  // HTML Ref
  let playerRef: HTMLCanvasElement | null = null;
  let audioRef: HTMLAudioElement | null = null;

  let showVersion = false;
</script>

<main>
  <div class="container">
    <h2>{$_("usage")}</h2>
    <ol>
      <li>{$_("usage_1")}</li>
      <li>{$_("usage_2")}</li>
      <li>{$_("usage_3")}</li>
    </ol>
    <button class="no-button action-link" on:click={() => showVersion = !showVersion}>
      {$_("supported_version")}
    </button>
    {#if showVersion}
    <ul style="margin-top: 0.25rem;">
      <li>Chrome 98+</li>
      <li>Edge 98+</li>
      <li>Firefox 94+</li>
      <li>Opera 84+</li>
      <li>Safari 15.4+</li>
    </ul>
    {/if}

    <ImageUploader
      fftSize={fftSize}
      on:message={(event) => {
        if (event.detail.imageLoaded) imageLoaded = event.detail.imageLoaded;
        imageData = event.detail.imageData;
        memoAlpha = event.detail.memoAlpha
        logToPixelIndexMap = event.detail.logToPixelIndexMap;
      }}
    />
    <AudioUploader
      on:mount={(event) => audioRef = event.detail.audioRef}
      on:message={(event) => {
        audioContext = event.detail.audioContext;
        nodeAnalyser = event.detail.nodeAnalyser;
        fftSize = event.detail.fftSize;
        recorderDestination = event.detail.recorderDestination;
      }}
      audioRef={audioRef}
      audioContext={audioContext}
      nodeAnalyser={nodeAnalyser}
      fftSize={fftSize}
      recorderDestination={recorderDestination}
    />

    <section>
      <h3>{$_("parameters_setting")}</h3>
      <!-- https://developer.mozilla.org/ja/docs/Web/HTML/Element/canvas -->
      <div style:display="flex" style:flex-wrap="wrap">
        <SizeInput
          playerWidth={playerWidth}
          playerHeight={playerHeight}
          on:message={(event) => {
            if (event.detail.playerWidth) playerWidth = event.detail.playerWidth;
            if (event.detail.playerHeight) playerHeight = event.detail.playerHeight;
          }}
        />
      </div>
      <p class="note">{$_("parameters_note")}</p>
      <label>{$_("parameters_background")}
        <input type="color" bind:value={background}>
        <!-- TODO: text color input -->
        <!-- <input bind:value={background}> -->
      </label>
      <br>
      <label>{$_("parameters_fft_size")}
        <select
          name="spectrum-fft-size" bind:value={fftSize}
          on:change={(e) => {
            const fftSize = Number(e.currentTarget.value)
            if (nodeAnalyser) nodeAnalyser.fftSize = fftSize;
            if (imageLoaded) {
              logToPixelIndexMap = generateLogToPixelIndexMap(fftSize, imageData.width);
            }
          }}
        >
          {#each [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768] as size }
            <option value={size} selected={size == fftSize} disabled={size < playerWidth}>{capitalize(String(size))}</option>
          {/each}
        </select>
      </label>
      <label>{$_("parameters_spectrum_type")}
        <select
          bind:value={spectrumType}
          on:change={(e) => {
            const type = e.currentTarget.value;
            if (isSpectrumType(type)) spectrumType = type;
          }}>
          {#each spectrumTypes as type }
            <option value={type}>{capitalize(type)}</option>
          {/each}
        </select>
      </label>
      {#if spectrumType == "pixel"}
      <div>
        <p>- pixel mode setting -</p>
        <label>{$_("parameters_sensitivity")}
          <input
            type="number" min="0.1" max="10" step="0.1"
            bind:value={spectrumSensitivity}
            on:change={e => spectrumSensitivity = clamp(Number(e.currentTarget.value), 0.1, 10)}
          />
        </label>
        <br>
        <label>{$_("parameters_grid_size")}
          <input type="number" min="0"
            bind:value={spectrumGridSize}
            on:change={e => spectrumGridSize = Math.max(0, Number(e.currentTarget.value))}
          />
        </label>
        <span>px</span>
        <br>
        <label>{$_("parameters_smooth")}
          <input type="number" min="0" step="100"
            bind:value={spectrumSmoothTime}
            on:change={e => spectrumSmoothTime = Math.max(0, Number(e.currentTarget.value))}
          />
        </label>
        <span>ms</span>
      </div>
      {/if}
    </section>

    <PlayerMenu
      playerRef={playerRef}
      audioContext={audioContext}
      audioRef={audioRef}
      imageLoaded={imageLoaded}
      recorderDestination={recorderDestination}
    />

    <PlayerCanvas
      on:mount={(event) => playerRef = event.detail.playerRef }
      imageLoaded={imageLoaded}
      playerRef={playerRef}
      background={background}
      fftSize={fftSize}
      imageData={imageData}
      logToPixelIndexMap={logToPixelIndexMap}
      memoAlpha={memoAlpha}
      nodeAnalyser={nodeAnalyser}
      playerHeight={playerHeight}
      playerWidth={playerWidth}
      spectrumGridSize={spectrumGridSize}
      spectrumSensitivity={spectrumSensitivity}
      spectrumSmoothTime={spectrumSmoothTime}
      spectrumType={spectrumType}
    />
  </div>
</main>
