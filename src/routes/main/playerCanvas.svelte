<script lang="ts">
	import { computeBandLevels, createBandMap, type BandMap } from '#lib/canvas.ts';
	import { createEventDispatcher, onMount } from 'svelte';

	const dispatch = createEventDispatcher();

	export let imageLoaded: boolean;
	export let imageData: ImageData;
	export let nodeAnalyser: AnalyserNode | null;

	// parameters
	export let playerWidth: number;
	export let playerHeight: number;
	export let background: string;
	export let spectrumSensitivity: number;
	export let spectrumGridSize: number;
	export let spectrumSmoothTime: number;

	// visibility
	export let playerRef: HTMLCanvasElement | null;
	let playerCtx: CanvasRenderingContext2D;
	let lastTime = performance.now();

	// 毎フレーム作り直さないよう、解析結果のバッファと対応表は使い回す
	let freqByteData = new Uint8Array(0);
	let levels = new Float32Array(0);
	let bandMap: BandMap | null = null;
	let bandMapKey = '';

	// 画像の 1 列ごとに別のビンを割り当てる
	const getBandMap = (binCount: number, columns: number) => {
		const key = `${binCount}:${columns}`;
		if (!bandMap || key != bandMapKey) {
			bandMap = createBandMap(binCount, columns);
			bandMapKey = key;
		}
		return bandMap;
	};

	const readLevels = (analyser: AnalyserNode, map: BandMap) => {
		if (freqByteData.length != analyser.frequencyBinCount) {
			freqByteData = new Uint8Array(analyser.frequencyBinCount);
		}
		analyser.getByteFrequencyData(freqByteData);
		if (levels.length != map.begin.length) levels = new Float32Array(map.begin.length);
		return computeBandLevels(freqByteData, map, levels);
	};

	// 画像まわりのキャッシュ。imageData が差し替わったときに作り直す
	let preparedImage: ImageData | null = null;
	// 描画先。画像サイズの canvas に毎フレーム透明度だけ書き換えて、拡大して貼る
	let pixelCanvas: HTMLCanvasElement;
	let pixelCtx: CanvasRenderingContext2D;
	let pixelOut: ImageData;
	let pixelAlpha: Float32Array; // 各ピクセルの現在の不透明度（0〜1）
	let sourceAlpha: Float32Array; // 元画像の不透明度（0〜1）
	let columnThreshold: Float32Array; // この行より下を点灯する

	const prepareImage = (image: ImageData) => {
		preparedImage = image;
		const { width, height } = image;

		pixelCanvas ??= document.createElement('canvas');
		pixelCanvas.width = width;
		pixelCanvas.height = height;
		pixelCtx = pixelCanvas.getContext('2d')!;
		pixelOut = new ImageData(new Uint8ClampedArray(image.data), width, height);
		pixelAlpha = new Float32Array(width * height);
		sourceAlpha = new Float32Array(width * height);
		for (let i = 0; i < width * height; i++) {
			sourceAlpha[i] = image.data[i * 4 + 3] / 255;
			pixelOut.data[i * 4 + 3] = 0;
		}
		columnThreshold = new Float32Array(width);
	};

	// 縮小するときは補間し、拡大するときはドットを保つ
	const drawScaled = (source: HTMLCanvasElement, w: number, h: number) => {
		playerCtx.imageSmoothingEnabled = source.width > w || source.height > h;
		playerCtx.drawImage(source, 0, 0, w, h);
	};

	const drawPixelSpectrum = (analyser: AnalyserNode, w: number, h: number, elapsed: number) => {
		const W = imageData.width;
		const H = imageData.height;
		const lv = readLevels(analyser, getBandMap(analyser.frequencyBinCount, W));

		// 1 - y / H <= level のピクセルを点灯する。y >= H * (1 - level) と同じ
		for (let x = 0; x < W; x++) {
			columnThreshold[x] = H * (1 - (lv[x] / 256) * spectrumSensitivity);
		}
		// スムーズは「点灯から消えるまでの時間（ms）」。フレームレートに依らないよう経過時間で減らす
		const decrement = spectrumSmoothTime <= 0 ? 1 : elapsed / spectrumSmoothTime;
		const out = pixelOut.data;
		for (let y = 0, i = 0; y < H; y++) {
			for (let x = 0; x < W; x++, i++) {
				const a = y >= columnThreshold[x] ? sourceAlpha[i] : Math.max(pixelAlpha[i] - decrement, 0);
				pixelAlpha[i] = a;
				out[i * 4 + 3] = a * 255;
			}
		}
		pixelCtx.putImageData(pixelOut, 0, 0);
		drawScaled(pixelCanvas, w, h);

		// グリッドはセルの境目を背景色で塗って表す（セルを内側に gridSize / 2 ずつ縮めるのと同じ見た目）
		if (spectrumGridSize > 0) {
			const half = spectrumGridSize / 2;
			const cellWidth = w / W;
			const cellHeight = h / H;
			playerCtx.beginPath();
			for (let x = 0; x <= W; x++) playerCtx.rect(cellWidth * x - half, 0, half * 2, h);
			for (let y = 0; y <= H; y++) playerCtx.rect(0, cellHeight * y - half, w, half * 2);
			playerCtx.fillStyle = background;
			playerCtx.fill();
		}
	};

	const draw = () => {
		if (!playerRef) return;
		requestAnimationFrame(draw);

		const now = performance.now();
		const elapsed = now - lastTime;
		lastTime = now;

		const w = playerRef.width;
		const h = playerRef.height;
		playerCtx.fillStyle = background;
		playerCtx.fillRect(0, 0, w, h);

		if (!nodeAnalyser) return;
		// 画像そのものをスペクトラムとして見せる
		if (imageLoaded) {
			if (imageData !== preparedImage) prepareImage(imageData);
			drawPixelSpectrum(nodeAnalyser, w, h, elapsed);
		} else {
			playerCtx.fillStyle = 'white';
			playerCtx.fillText('No Image', 10, 20);
		}
	};

	onMount(() => {
		playerCtx = playerRef?.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
		draw();

		dispatch('mount', {
			playerRef: playerRef
		});
	});
</script>

<section>
	<div class="canvas-container">
		<canvas
			id="player"
			bind:this={playerRef}
			width={playerWidth}
			height={playerHeight}
			style:background
		></canvas>
	</div>
</section>
