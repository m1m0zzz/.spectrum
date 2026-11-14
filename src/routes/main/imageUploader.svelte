<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import {
		loadImage,
		MAX_IMAGE_PIXELS,
		maxPercentWithin,
		resample,
		scaledSize,
		type Pixels
	} from '#lib/image.ts';
	import { aspectLabel, cropPixels, fullRect, isFullRect, type Rect } from '#lib/crop.ts';
	import FileInput from './fileInput.svelte';
	import CropBox from './cropBox.svelte';

	const dispatch = createEventDispatcher();

	// 動画の作成中は画像やドット化の設定を変えられないようにする
	export let disabled = false;

	let previewRef: HTMLCanvasElement | null;
	let img: HTMLImageElement | null;
	let files: FileList | undefined;

	// 読み込んだ画像の画素。ドット化の割合を動かすたびに読み直さないよう、読み込んだときに 1 回だけ取る
	let source: ImageData | null = null;
	let imageData: ImageData;

	// ドット化したときの大きさ（元の画像に対する %、1〜100）
	let pixelationPercent = 50;
	let isDoPixelation = false;

	// トリミングの範囲（元の画像の px）と、プレビューで範囲を調整しているところか。
	// トリミングしてからドット化する（縮小率はトリミングした画像に対する割合）
	let crop: Rect = fullRect({ width: 0, height: 0 });
	let cropping = false;

	let imgError = false;
	$: imageLoaded = Boolean(img && img.src != '');
	$: pixelatedSize = scaledSize(crop.width, crop.height, pixelationPercent);
	$: cropped = source != null && !isFullRect(crop, source);
	$: cropAspect = aspectLabel(crop);

	onMount(() => {
		img = new Image();
	});

	const toImageData = ({ width, height, data }: Pixels<ArrayBuffer>) =>
		new ImageData(data, width, height);
	const pixelate = (pixels: ImageData) =>
		isDoPixelation ? toImageData(resample(pixels, pixelationPercent)) : pixels;

	// トリミングとドット化をして、スペクトラムに使う画像として親に渡す
	const applyImage = (_imageLoaded = false) => {
		if (!source) return;
		imageData = pixelate(isFullRect(crop, source) ? source : toImageData(cropPixels(source, crop)));

		let obj = { imageData: imageData };
		if (_imageLoaded) {
			obj = Object.assign(obj, { imageLoaded: true });
		}
		dispatch('message', obj);
	};

	// プレビュー。トリミングの範囲を調整している間は、範囲を選べるように画像全体（ドット化したもの）を見せる
	const drawPreview = () => {
		if (!previewRef || !source) return;
		const shown = cropping ? pixelate(source) : imageData;
		previewRef.width = shown.width;
		previewRef.height = shown.height;
		previewRef.getContext('2d')?.putImageData(shown, 0, 0);
	};

	const pixelationImage = (_imageLoaded = false) => {
		applyImage(_imageLoaded);
		drawPreview();
	};

	const toggleCropping = () => {
		cropping = !cropping;
		drawPreview();
	};

	let objectUrl: string | null = null;

	const uploadImage = async () => {
		// data URL（base64）にすると大きい画像でメモリと時間を食うため、object URL で読む
		// ダイアログを取り消すと選択が空になる。そのときは今の画像のままにする
		if (!files?.[0]) return;
		if (objectUrl) URL.revokeObjectURL(objectUrl);
		objectUrl = URL.createObjectURL(files[0]);
		img = await loadImage(objectUrl);

		// 画素を取るための作業用の canvas
		const work = document.createElement('canvas');
		work.width = img.width;
		work.height = img.height;
		const ctx = work.getContext('2d') as CanvasRenderingContext2D;
		ctx.drawImage(img, 0, 0);
		source = ctx.getImageData(0, 0, img.width, img.height);
		crop = fullRect(source);
		cropping = false;

		if (img.width * img.height > MAX_IMAGE_PIXELS) {
			imgError = true;
			isDoPixelation = true;
			// 上限に収まるいちばん大きい割合
			pixelationPercent = maxPercentWithin(img.width, img.height);
		} else {
			imgError = false;
			isDoPixelation = false;
		}

		pixelationImage(true);
	};
</script>

<section>
	<h3>🖼️ {$_('upload_image')}</h3>
	<FileInput
		id="image-file"
		accept="image/*"
		ariaLabel="Upload image"
		{disabled}
		bind:files
		on:change={() => uploadImage()}
	/>
	{#if imgError}
		<p class="error">
			{$_('upload_image_error')}
		</p>
	{/if}
	{#if imageLoaded}
		<p>
			{$_('image_info', { values: { width: img?.width || 0, height: img?.height || 0 } })}
		</p>
		<div style="margin-top: 0.5rem;">
			<p>
				<span>{$_('is_pixelation')}</span>
				<button
					class={'no-button ' + (isDoPixelation ? 'pixelation-active' : 'action-link')}
					{disabled}
					on:click={() => {
						isDoPixelation = true;
						pixelationImage();
					}}>{isDoPixelation ? '>' : ''}{$_('do_pixelation')}</button
				>
				<span>/</span>
				<button
					class={'no-button ' + (isDoPixelation ? 'action-link' : 'pixelation-active')}
					{disabled}
					on:click={() => {
						isDoPixelation = false;
						pixelationImage();
					}}>{isDoPixelation ? '' : '>'}{$_('do_not_pixelation')}</button
				>
			</p>
			{#if isDoPixelation}
				<!-- 上の段に縮小率（スライダーと %）、下の段に右寄せで出来上がりの大きさ -->
				<div class="pixelation-size">
					<div class="pixelation-size-row">
						<label for="pixelation-percent">{$_('pixelation_size')}</label>
						<input
							id="pixelation-percent"
							type="range"
							class="pixel-range"
							min="1"
							max="100"
							step="1"
							{disabled}
							value={pixelationPercent}
							on:input={(e) => {
								pixelationPercent = Number(e.currentTarget.value);
								pixelationImage();
							}}
							style:--progress="{((pixelationPercent - 1) / 99) * 100}%"
						/>
						<span class="pixelation-size-percent"
							><span>{pixelationPercent}%</span><span aria-hidden="true">100%</span></span
						>
					</div>
					<p class="pixelation-size-result">
						{pixelatedSize.width} px × {pixelatedSize.height} px
					</p>
				</div>
			{/if}
		</div>
	{/if}

	<div class="img-preview-container" style:display={imageLoaded ? 'block' : 'none'}>
		<!-- トリミング。押すと、プレビューに枠を出して範囲を調整できる。調整している間は大きさと縦横比を出す -->
		<div class="img-crop-toolbar">
			<button class="pixel-button" aria-pressed={cropping} {disabled} on:click={toggleCropping}
				>{cropping ? $_('crop_done') : $_('crop')}</button
			>
			{#if cropping}
				<button
					class="no-button action-link"
					disabled={disabled || !cropped}
					on:click={() => {
						if (!source) return;
						crop = fullRect(source);
						applyImage();
					}}>{$_('crop_reset')}</button
				>
				<p class="img-crop-size">
					{#if cropAspect}<span class="img-crop-aspect">{cropAspect}</span>{/if}
					<span>{crop.width} px × {crop.height} px</span>
				</p>
			{/if}
		</div>
		<div class="img-crop">
			<canvas id="preview" bind:this={previewRef} width="0" height="0"></canvas>
			{#if cropping && source}
				<CropBox
					width={source.width}
					height={source.height}
					{disabled}
					bind:rect={crop}
					on:change={() => applyImage()}
				/>
			{/if}
		</div>
	</div>
</section>
