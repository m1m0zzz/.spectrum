import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_PIXELS, maxPercentWithin, resample, scaledSize } from './image.ts';

// 各画素の R に x、G に y を入れた画像
const gradient = (width: number, height: number) => {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (width * y + x) * 4;
			data.set([x, y, 0, 255], i);
		}
	}
	return { width, height, data };
};
const at = (img: ReturnType<typeof resample>, x: number, y: number) => {
	const i = (img.width * y + x) * 4;
	return [img.data[i], img.data[i + 1]];
};

describe('scaledSize', () => {
	it('切り捨て、1 より小さくしない', () => {
		expect(scaledSize(33, 20, 50)).toEqual({ width: 16, height: 10 });
		expect(scaledSize(10, 10, 1)).toEqual({ width: 1, height: 1 });
		expect(scaledSize(640, 480, 100)).toEqual({ width: 640, height: 480 });
	});
});

describe('resample', () => {
	it('100% では元のまま', () => {
		const src = gradient(7, 5);
		expect(resample(src, 100)).toEqual(src);
	});

	it('1/n にあたる割合では、n 画素おきの左上の画素を拾う（以前の 1/n の間引きと同じ）', () => {
		const out = resample(gradient(40, 30), 25);
		expect(out.width).toBe(10);
		expect(out.height).toBe(7);
		expect(at(out, 0, 0)).toEqual([0, 0]);
		expect(at(out, 3, 2)).toEqual([12, 8]);
		expect(at(out, 9, 6)).toEqual([36, 25]);
	});

	it('割り切れない割合でも、元の画像の範囲の画素を拾う', () => {
		const out = resample(gradient(100, 100), 37);
		expect(out.width).toBe(37);
		expect(at(out, 36, 36)).toEqual([97, 97]);
	});
});

describe('maxPercentWithin', () => {
	it('上限以下の画像は 100%', () => {
		expect(maxPercentWithin(1024, 1024)).toBe(100);
		expect(maxPercentWithin(32, 32)).toBe(100);
	});

	it('上限を超える画像は、上限に収まるいちばん大きい割合', () => {
		for (const [w, h] of [
			[1800, 1200],
			[4000, 3000],
			[1025, 1024],
			[10000, 200]
		]) {
			const p = maxPercentWithin(w, h);
			const fit = scaledSize(w, h, p);
			const over = scaledSize(w, h, p + 1);
			expect(fit.width * fit.height).toBeLessThanOrEqual(MAX_IMAGE_PIXELS);
			expect(over.width * over.height).toBeGreaterThan(MAX_IMAGE_PIXELS);
		}
	});
});
