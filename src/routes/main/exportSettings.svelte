<script lang="ts">
	import { _ } from 'svelte-i18n';
	import PixelNumber from './pixelNumber.svelte';
	import PixelSelect from './pixelSelect.svelte';
	import {
		audioBitrates,
		frameRates,
		qualities,
		speeds,
		videoFormats,
		type EncodeSettings
	} from '#lib/encode.ts';

	export let settings: EncodeSettings;
	export let rangeStart: number;
	export let rangeEnd: number;
	// 曲を読み込んだうえで範囲が正しくないとき true
	export let rangeError: boolean;
	export let audioDuration: number;
	// 書き出し中は設定を変えられないようにする
	export let busy: boolean;

	$: formatOptions = videoFormats.map((v) => ({ value: v, label: $_(`export_format_${v}`) }));
	$: qualityOptions = qualities.map((v) => ({ value: v, label: $_(`export_quality_${v}`) }));
	$: speedOptions = speeds.map((v) => ({ value: v, label: $_(`export_speed_${v}`) }));
	const fpsOptions = frameRates.map((v) => ({ value: v as number, label: `${v} fps` }));
	const bitrateOptions = audioBitrates.map((v) => ({ value: v as number, label: `${v} kbps` }));
</script>

<section>
	<p>
		<span>{$_('export_range')}</span>
		<PixelNumber>
			<input
				type="number"
				min="0"
				max={audioDuration}
				step="0.1"
				bind:value={rangeStart}
				aria-label={$_('export_range_start')}
				disabled={busy}
			/>
		</PixelNumber>
		<span>〜</span>
		<PixelNumber>
			<input
				type="number"
				min="0"
				max={audioDuration}
				step="0.1"
				bind:value={rangeEnd}
				aria-label={$_('export_range_end')}
				disabled={busy}
			/>
		</PixelNumber>
		<span>{$_('export_range_seconds')}</span>
	</p>
	{#if rangeError}
		<p class="error">{$_('export_range_error')}</p>
	{/if}
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
	<p>
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
