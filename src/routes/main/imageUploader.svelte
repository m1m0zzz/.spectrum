<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { executePixelationSampling, loadImage, MAX_IMAGE_PIXELS } from '#lib/image.ts';
	import FileInput from './fileInput.svelte';

	const dispatch = createEventDispatcher();

	let previewRef: HTMLCanvasElement | null;
	let img: HTMLImageElement | null;
	let files: FileList | undefined;

	let imageData: ImageData;

	let pixelationSize = 2;
	let isDoPixelation = false;

	let imgError = false;
	$: imageLoaded = Boolean(img && img.src != '');

	onMount(() => {
		img = new Image();
	});

	const pixelationImage = (
		isDoPixelation: boolean,
		pixelationSize: number,
		previewRef: HTMLCanvasElement | null,
		img: HTMLImageElement | null,
		_imageLoaded = false
	) => {
		if (!previewRef || !img) return;
		const previewCtx = previewRef.getContext('2d') as CanvasRenderingContext2D;
		previewRef.width = img.width;
		previewRef.height = img.height;
		previewCtx.drawImage(img, 0, 0);

		if (isDoPixelation) {
			imageData = executePixelationSampling(previewCtx, img, pixelationSize);
		} else {
			imageData = previewCtx.getImageData(0, 0, img.width, img.height);
		}

		let obj = { imageData: imageData };
		if (_imageLoaded) {
			obj = Object.assign(obj, { imageLoaded: true });
		}
		dispatch('message', obj);
	};

	let objectUrl: string | null = null;

	const uploadImage = async () => {
		// data URL（base64）にすると大きい画像でメモリと時間を食うため、object URL で読む
		// ダイアログを取り消すと選択が空になる。そのときは今の画像のままにする
		if (!files?.[0]) return;
		if (objectUrl) URL.revokeObjectURL(objectUrl);
		objectUrl = URL.createObjectURL(files[0]);
		img = await loadImage(objectUrl);

		const pixels = img.width * img.height;
		if (pixels > MAX_IMAGE_PIXELS) {
			imgError = true;
			isDoPixelation = true;
			// 上限に収まる最小の間引き幅
			pixelationSize = Math.max(2, Math.ceil(Math.sqrt(pixels / MAX_IMAGE_PIXELS)));
		} else {
			imgError = false;
			isDoPixelation = false;
		}

		pixelationImage(isDoPixelation, pixelationSize, previewRef, img, true);
	};
</script>

<section>
	<h3>🖼️ {$_('upload_image')}</h3>
	<FileInput
		id="image-file"
		accept="image/*"
		ariaLabel="Upload image"
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
					on:click={() => {
						isDoPixelation = true;
						pixelationImage(isDoPixelation, pixelationSize, previewRef, img);
					}}>{isDoPixelation ? '>' : ''}{$_('do_pixelation')}</button
				>
				<span>/</span>
				<button
					class={'no-button ' + (isDoPixelation ? 'action-link' : 'pixelation-active')}
					on:click={() => {
						isDoPixelation = false;
						pixelationImage(isDoPixelation, pixelationSize, previewRef, img);
					}}>{isDoPixelation ? '' : '>'}{$_('do_not_pixelation')}</button
				>
			</p>
			{#if isDoPixelation}
				<p>
					<span>X: </span>
					<span>1 / </span>
					<input
						type="number"
						min="2"
						bind:value={pixelationSize}
						on:change={(e) => {
							if (previewRef && img) {
								pixelationImage(
									isDoPixelation,
									Math.max(2, Number(e.currentTarget.value)),
									previewRef,
									img
								);
							} else {
								console.error('at onChange pixelationSize');
							}
						}}
					/>
					<span>
						=&gt; ( {pixelationSize ? Math.floor((img?.width || 0) / pixelationSize) : 0} px × {pixelationSize
							? Math.floor((img?.height || 0) / pixelationSize)
							: 0} px )
					</span>
				</p>
			{/if}
		</div>
	{/if}

	<div class="img-preview-container" style:display={imageLoaded ? 'block' : 'none'}>
		<canvas id="preview" bind:this={previewRef} width="0" height="0"></canvas>
	</div>
</section>
