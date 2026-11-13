<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import {
		loadImage,
		MAX_IMAGE_PIXELS,
		maxPercentWithin,
		resample,
		scaledSize
	} from '#lib/image.ts';
	import FileInput from './fileInput.svelte';

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

	let imgError = false;
	$: imageLoaded = Boolean(img && img.src != '');
	$: pixelatedSize = source
		? scaledSize(source.width, source.height, pixelationPercent)
		: { width: 0, height: 0 };

	onMount(() => {
		img = new Image();
	});

	// プレビューに描き、スペクトラムに使う画像として親に渡す
	const pixelationImage = (_imageLoaded = false) => {
		if (!previewRef || !source) return;
		if (isDoPixelation) {
			const { width, height, data } = resample(source, pixelationPercent);
			imageData = new ImageData(data, width, height);
		} else {
			imageData = source;
		}
		previewRef.width = imageData.width;
		previewRef.height = imageData.height;
		previewRef.getContext('2d')?.putImageData(imageData, 0, 0);

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

		// 画素を取るための作業用の canvas
		const work = document.createElement('canvas');
		work.width = img.width;
		work.height = img.height;
		const ctx = work.getContext('2d') as CanvasRenderingContext2D;
		ctx.drawImage(img, 0, 0);
		source = ctx.getImageData(0, 0, img.width, img.height);

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
		<canvas id="preview" bind:this={previewRef} width="0" height="0"></canvas>
	</div>
</section>
