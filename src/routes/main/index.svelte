<script lang="ts">
	import { _ } from 'svelte-i18n';
	import PixelNumber from './pixelNumber.svelte';

	import { clamp } from '#lib/util.ts';

	import ImageUploader from './imageUploader.svelte';
	import AudioUploader from './audioUploader.svelte';
	import PlayerCanvas from './playerCanvas.svelte';
	import PlayerMenu from './playerMenu.svelte';
	import ExportSettings from './exportSettings.svelte';
	import SizeInput from './sizeInput.svelte';
	import PixelSelect from './pixelSelect.svelte';
	import AudioPlayer from './audioPlayer.svelte';
	import { defaultEncodeSettings, type EncodeSettings } from '#lib/encode.ts';

	let imageLoaded = false;
	let imageData: ImageData;
	let audioDuration = 0;
	let audioContext: AudioContext | null;
	let nodeAnalyser: AnalyserNode | null;
	let recorderDestination: MediaStreamAudioDestinationNode;

	// parameters
	let playerWidth = 320;
	let playerHeight = 320;
	let background = '#000000';
	let fftSize = 8192;
	let spectrumSensitivity = 1;
	let spectrumGridSize = 0;
	let spectrumSmoothTime = 0;

	// HTML Ref
	let playerRef: HTMLCanvasElement | null = null;
	let audioRef: HTMLAudioElement | null = null;

	let showVersion = false;

	// 画像の 1 列ごとに別の周波数ビンを割り当てられない（ビンが足りない）サイズは選べなくする
	const FFT_SIZES = [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768];
	$: fftOptions = FFT_SIZES.map((size) => ({
		value: size,
		label: String(size),
		disabled: imageLoaded && size / 2 - 1 < imageData.width
	}));

	// 書き出しの設定と範囲（秒）。範囲は曲が変わったら全体に戻す
	let encodeSettings: EncodeSettings = { ...defaultEncodeSettings };
	let rangeStart = 0;
	let rangeEnd = 0;
	// 動画の作成中（録画・変換）か。作成中は、作成に関わる操作（ファイル・設定・再生プレイヤー）をすべて止める
	let exporting = false;
	const resetRange = (duration: number) => {
		rangeStart = 0;
		rangeEnd = Number.isFinite(duration) ? duration : 0;
	};
	$: resetRange(audioDuration);
	$: rangeError =
		audioDuration > 0 && !(0 <= rangeStart && rangeStart < rangeEnd && rangeEnd <= audioDuration);

	// タブ。切り替えても中身（読み込んだ画像や、入力中の値）を保つため、パネルは破棄せず hidden で隠す
	const tabs = ['file', 'settings', 'video'] as const;
	type Tab = (typeof tabs)[number];
	let activeTab: Tab = 'file';
	let tabRefs: HTMLButtonElement[] = [];

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

<main>
	<div class="container">
		<!-- キャンバスより上（使い方・タブ・再生プレイヤー）は、キャンバスとは別に中央に揃える（style.css の .controls） -->
		<div class="controls">
			<h2>{$_('usage')}</h2>
			<ol>
				<li>{$_('usage_1')}</li>
				<li>{$_('usage_2')}</li>
				<li>{$_('usage_3')}</li>
			</ol>
			<button class="no-button action-link" on:click={() => (showVersion = !showVersion)}>
				{$_('supported_version')}
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

			<!-- タブとパネルの幅は、いちばん広いパネルに合わせる（style.css の .tab-view） -->
			<div class="tab-view">
				<div class="tabs" role="tablist">
					{#each tabs as tab, i (tab)}
						<button
							class="tab"
							role="tab"
							id="tab-{tab}"
							aria-selected={activeTab == tab}
							aria-controls="tab-panel-{tab}"
							tabindex={activeTab == tab ? 0 : -1}
							bind:this={tabRefs[i]}
							on:click={() => (activeTab = tab)}
							on:keydown={(e) => onTabKeydown(e, i)}>{$_(`tab_${tab}`)}</button
						>
					{/each}
				</div>

				<div
					class="tab-panel"
					role="tabpanel"
					id="tab-panel-file"
					aria-labelledby="tab-file"
					hidden={activeTab != 'file'}
				>
					<ImageUploader
						disabled={exporting}
						on:message={(event) => {
							if (event.detail.imageLoaded) imageLoaded = event.detail.imageLoaded;
							imageData = event.detail.imageData;
						}}
					/>
					<AudioUploader
						on:message={(event) => {
							audioContext = event.detail.audioContext;
							nodeAnalyser = event.detail.nodeAnalyser;
							fftSize = event.detail.fftSize;
							recorderDestination = event.detail.recorderDestination;
						}}
						{audioRef}
						{audioContext}
						{nodeAnalyser}
						{fftSize}
						{recorderDestination}
						disabled={exporting}
					/>
				</div>

				<div
					class="tab-panel"
					role="tabpanel"
					id="tab-panel-settings"
					aria-labelledby="tab-settings"
					hidden={activeTab != 'settings'}
				>
					<section>
						<div style:display="flex" style:flex-wrap="wrap">
							<SizeInput
								{playerWidth}
								{playerHeight}
								disabled={exporting}
								on:message={(event) => {
									if (event.detail.playerWidth) playerWidth = event.detail.playerWidth;
									if (event.detail.playerHeight) playerHeight = event.detail.playerHeight;
								}}
							/>
						</div>
						<p>
							<label
								>{$_('parameters_background')}
								<input type="color" bind:value={background} disabled={exporting} />
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
								bind:value={fftSize}
								disabled={exporting}
								on:change={(e) => {
									if (nodeAnalyser) nodeAnalyser.fftSize = e.detail.value;
								}}
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
										disabled={exporting}
										bind:value={spectrumSensitivity}
										on:change={(e) =>
											(spectrumSensitivity = clamp(Number(e.currentTarget.value), 0.1, 10))}
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
										disabled={exporting}
										bind:value={spectrumGridSize}
										on:change={(e) =>
											(spectrumGridSize = Math.max(0, Number(e.currentTarget.value)))}
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
										disabled={exporting}
										bind:value={spectrumSmoothTime}
										on:change={(e) =>
											(spectrumSmoothTime = Math.max(0, Number(e.currentTarget.value)))}
									/>
								</PixelNumber>
							</label>
							<span>ms</span>
						</p>
					</section>
				</div>

				<div
					class="tab-panel"
					role="tabpanel"
					id="tab-panel-video"
					aria-labelledby="tab-video"
					hidden={activeTab != 'video'}
				>
					<ExportSettings
						bind:settings={encodeSettings}
						bind:rangeStart
						bind:rangeEnd
						{rangeError}
						{audioDuration}
						busy={exporting}
					/>
				</div>
			</div>

			<!-- 再生プレイヤーは、どのタブを開いていても操作できるようタブの外に置き、音声を読み込む前から常に表示する。
			     作成中は一時停止・シーク・音量で録画が止まる・ずれる・音が変わるため、操作できなくする -->
			<section>
				<AudioPlayer
					bind:audio={audioRef}
					bind:duration={audioDuration}
					bind:rangeStart
					bind:rangeEnd
					locked={exporting}
				/>
			</section>
		</div>

		<PlayerCanvas
			on:mount={(event) => (playerRef = event.detail.playerRef)}
			{imageLoaded}
			{playerRef}
			{background}
			{imageData}
			{nodeAnalyser}
			{playerHeight}
			{playerWidth}
			{spectrumGridSize}
			{spectrumSensitivity}
			{spectrumSmoothTime}
		/>

		<PlayerMenu
			{playerRef}
			{audioContext}
			{audioRef}
			{imageLoaded}
			{recorderDestination}
			settings={encodeSettings}
			{rangeStart}
			{rangeEnd}
			{rangeError}
			bind:busy={exporting}
		/>
	</div>
</main>
