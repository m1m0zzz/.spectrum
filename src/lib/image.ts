// pixel モードでそのまま扱える画像の画素数の上限。超えるときはドット化を勧める
export const MAX_IMAGE_PIXELS = 1024 * 1024;

export const loadImage = (src: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = (e) => reject(e);
		img.src = src;
	});

// ドット化（間引き）。元の画像を percent %（1〜100 の整数）の大きさにし、各ドットには対応する位置の
// 左上の画素をそのまま使う（平均すると色が混ざり、ドット絵らしさが失われるため）。
// 大きさは切り捨て、1 ドットより小さくはしない
type Pixels<T extends ArrayBufferLike = ArrayBufferLike> = {
	width: number;
	height: number;
	data: Uint8ClampedArray<T>;
};
export const scaledSize = (width: number, height: number, percent: number) => ({
	width: Math.max(1, Math.floor((width * percent) / 100)),
	height: Math.max(1, Math.floor((height * percent) / 100))
});

export const resample = (src: Pixels, percent: number): Pixels<ArrayBuffer> => {
	const { width, height } = scaledSize(src.width, src.height, percent);
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		const sy = Math.floor((y * src.height) / height);
		for (let x = 0; x < width; x++) {
			const sx = Math.floor((x * src.width) / width);
			const from = (src.width * sy + sx) * 4;
			const to = (width * y + x) * 4;
			data[to] = src.data[from];
			data[to + 1] = src.data[from + 1];
			data[to + 2] = src.data[from + 2];
			data[to + 3] = src.data[from + 3];
		}
	}
	return { width, height, data };
};

// 画素数が MAX_IMAGE_PIXELS に収まる、いちばん大きい割合（%）
export const maxPercentWithin = (width: number, height: number) => {
	let percent = Math.min(100, Math.floor(100 * Math.sqrt(MAX_IMAGE_PIXELS / (width * height))));
	while (percent > 1) {
		const size = scaledSize(width, height, percent);
		if (size.width * size.height <= MAX_IMAGE_PIXELS) break;
		percent--;
	}
	return Math.max(1, percent);
};
