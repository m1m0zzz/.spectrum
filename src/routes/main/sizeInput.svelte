<script lang="ts">
	import { clamp } from '#lib/util.ts';
	import { createEventDispatcher } from 'svelte';
	import { _ } from 'svelte-i18n';
	import PixelSelect from './pixelSelect.svelte';

	const dispatch = createEventDispatcher();

	export let playerWidth: number;
	export let playerHeight: number;

	const DISPLAY_SIZES: { [key: string]: number[] | undefined } = {
		'144p (256×144)': [256, 144],
		'240p (427×240)': [427, 240],
		'360p (640×360)': [640, 360],
		'480p (720×480)': [720, 480],
		'720p (1280×720)': [1280, 720],
		'1080p (1920×1080)': [1920, 1080],
		custom: undefined
	};

	// 選択欄の値。プリセットは "幅,高さ"、カスタムは 'custom'
	let sizeValue = 'custom';
	$: customInput = sizeValue == 'custom';
	$: sizeOptions = Object.entries(DISPLAY_SIZES).map(([key, size]) => ({
		value: size ? size.join(',') : 'custom',
		label: key == 'custom' ? $_('parameters_custom') : key
	}));

	const onSizeChange = (value: string) => {
		if (value == 'custom') return;
		const m = value.match(/(\d+),(\d+)/);
		if (!m) throw new Error('canvas size is not match!');
		playerWidth = Number(m[1]);
		playerHeight = Number(m[2]);
		dispatch('message', {
			playerWidth: playerWidth,
			playerHeight: playerHeight
		});
	};

	// NOTE: canvas size
	// https://developer.mozilla.org/ja/docs/Web/HTML/Element/canvas#キャンバスの最大寸法
</script>

<div>
	<span id="size-label">{$_('parameters_window_size')}</span>
	<PixelSelect
		id="size"
		labelledby="size-label"
		options={sizeOptions}
		bind:value={sizeValue}
		on:change={(e) => onSizeChange(e.detail.value)}
	/>
	{#if customInput}
		<br />
		<label style:padding-right="20px"
			>{$_('parameters_width')}
			<input
				type="number"
				min="1"
				max="16384"
				bind:value={playerWidth}
				on:change={(e) => {
					playerWidth = clamp(Number(e.currentTarget.value), 1, 16384);
					dispatch('message', { playerWidth: playerWidth });
				}}
			/>
			<span>px</span>
		</label>
		<label style:padding-right="20px"
			>{$_('parameters_height')}
			<input
				type="number"
				min="1"
				max="16384"
				bind:value={playerHeight}
				on:change={(e) => {
					playerHeight = clamp(Number(e.currentTarget.value), 1, 16384);
					dispatch('message', { playerHeight: playerHeight });
				}}
			/>
			<span>px</span>
		</label>
	{/if}
</div>
