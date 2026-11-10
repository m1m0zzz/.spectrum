<script lang="ts">
	import { _ } from 'svelte-i18n';
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
	export let audioRef: HTMLAudioElement | null;
	// 書き出し中は設定を変えられないようにする
	export let busy: boolean;

	const roundTime = (t: number) => Math.round(t * 10) / 10;
</script>

<section>
	<p>
		<span>{$_('export_range')}</span>
		<label>
			{$_('export_range_start')}
			<input
				type="number"
				min="0"
				max={audioDuration}
				step="0.1"
				bind:value={rangeStart}
				disabled={busy}
			/>
		</label>
		<button
			class="no-button action-link"
			disabled={busy || !audioRef}
			on:click={() => audioRef && (rangeStart = roundTime(audioRef.currentTime))}
			>{$_('export_set_current')}</button
		>
		<span>〜</span>
		<label>
			{$_('export_range_end')}
			<input
				type="number"
				min="0"
				max={audioDuration}
				step="0.1"
				bind:value={rangeEnd}
				disabled={busy}
			/>
		</label>
		<button
			class="no-button action-link"
			disabled={busy || !audioRef}
			on:click={() => audioRef && (rangeEnd = roundTime(audioRef.currentTime))}
			>{$_('export_set_current')}</button
		>
		<span>{$_('export_range_seconds', { values: { duration: audioDuration.toFixed(1) } })}</span>
	</p>
	{#if rangeError}
		<p class="error">{$_('export_range_error')}</p>
	{/if}
	<p>
		<label>
			{$_('export_format')}
			<select bind:value={settings.format} disabled={busy}>
				{#each videoFormats as format (format)}
					<option value={format}>{$_(`export_format_${format}`)}</option>
				{/each}
			</select>
		</label>
	</p>
	<p>
		<label>
			{$_('export_quality')}
			<select bind:value={settings.quality} disabled={busy}>
				{#each qualities as quality (quality)}
					<option value={quality}>{$_(`export_quality_${quality}`)}</option>
				{/each}
			</select>
		</label>
	</p>
	<p>
		<label>
			{$_('export_speed')}
			<select bind:value={settings.speed} disabled={busy}>
				{#each speeds as speed (speed)}
					<option value={speed}>{$_(`export_speed_${speed}`)}</option>
				{/each}
			</select>
		</label>
	</p>
	<p>
		<label>
			{$_('export_fps')}
			<select bind:value={settings.fps} disabled={busy}>
				{#each frameRates as fps (fps)}
					<option value={fps}>{fps} fps</option>
				{/each}
			</select>
		</label>
	</p>
	<p>
		<label>
			{$_('export_audio_bitrate')}
			<select bind:value={settings.audioBitrate} disabled={busy}>
				{#each audioBitrates as bitrate (bitrate)}
					<option value={bitrate}>{bitrate} kbps</option>
				{/each}
			</select>
		</label>
	</p>
</section>
