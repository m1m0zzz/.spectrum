// pixel モードでそのまま扱える画像の画素数の上限。超えるときはドット化を勧める
export const MAX_IMAGE_PIXELS = 1024 * 1024;

export const loadImage = (src: string) =>
	new Promise<HTMLImageElement>((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = (e) => reject(e);
		img.src = src;
	});

// ピクセル化(サンプリング) (pixelSizeの大きさ)
// pixelSize 四方の左上のピクセルを拾う。割り切れない端の余りは捨てる
export const executePixelationSampling = (
	context: CanvasRenderingContext2D,
	img: HTMLImageElement,
	pixelSize: number
) => {
	const newWidth = Math.floor(img.width / pixelSize);
	const newHeight = Math.floor(img.height / pixelSize);

	// draw original image
	context.canvas.width = img.width;
	context.canvas.height = img.height;
	context.drawImage(img, 0, 0);

	const src = context.getImageData(0, 0, img.width, img.height).data;
	const newImageData = new ImageData(newWidth, newHeight);
	const dst = newImageData.data;

	for (let y = 0; y < newHeight; y++) {
		for (let x = 0; x < newWidth; x++) {
			const from = (img.width * y * pixelSize + x * pixelSize) * 4;
			const to = (newWidth * y + x) * 4;
			dst[to] = src[from];
			dst[to + 1] = src[from + 1];
			dst[to + 2] = src[from + 2];
			dst[to + 3] = src[from + 3];
		}
	}

	context.canvas.width = newWidth;
	context.canvas.height = newHeight;
	context.putImageData(newImageData, 0, 0);

	return newImageData;
};
