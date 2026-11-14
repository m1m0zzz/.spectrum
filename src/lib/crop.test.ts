import { describe, expect, it } from 'vitest';
import { aspectLabel, cropPixels, dragRect, fullRect, isFullRect, type Rect } from './crop.ts';

const bounds = { width: 400, height: 300 };
const rect = (x: number, y: number, width: number, height: number): Rect => ({
	x,
	y,
	width,
	height
});

describe('dragRect', () => {
	it('内側をつかむと、大きさを変えずに動かし、画像からはみ出させない', () => {
		const start = rect(10, 10, 100, 50);
		expect(dragRect(start, 'move', 20.4, 30.6, bounds)).toEqual(rect(30, 41, 100, 50));
		expect(dragRect(start, 'move', -100, 1000, bounds)).toEqual(rect(0, 250, 100, 50));
	});

	it('辺をつかむと、その辺だけを動かす', () => {
		const start = rect(10, 10, 100, 50);
		expect(dragRect(start, 'e', 15, 99, bounds)).toEqual(rect(10, 10, 115, 50));
		expect(dragRect(start, 'w', 5, 99, bounds)).toEqual(rect(15, 10, 95, 50));
		expect(dragRect(start, 'n', 99, -10, bounds)).toEqual(rect(10, 0, 100, 60));
		expect(dragRect(start, 's', 99, 7, bounds)).toEqual(rect(10, 10, 100, 57));
	});

	it('角をつかむと、2 つの辺を動かす', () => {
		const start = rect(10, 10, 100, 50);
		expect(dragRect(start, 'se', 5, 7, bounds)).toEqual(rect(10, 10, 105, 57));
		expect(dragRect(start, 'nw', -5, -7, bounds)).toEqual(rect(5, 3, 105, 57));
	});

	it('画像の外へは広げず、最小の大きさより小さくしない', () => {
		const start = rect(10, 10, 100, 50);
		expect(dragRect(start, 'se', 1000, 1000, bounds)).toEqual(rect(10, 10, 390, 290));
		expect(dragRect(start, 'nw', -1000, -1000, bounds)).toEqual(rect(0, 0, 110, 60));
		expect(dragRect(start, 'e', -1000, 0, bounds, { minSize: 20 })).toEqual(rect(10, 10, 20, 50));
		expect(dragRect(start, 'n', 0, 1000, bounds, { minSize: 20 })).toEqual(rect(10, 40, 100, 20));
	});

	it('縦横比の近くでは、動かしている辺をずらして吸着させる', () => {
		const start = rect(0, 0, 100, 90);
		// 幅 117 → 4:3（120 × 90）に吸着
		expect(dragRect(start, 'e', 17, 0, bounds, { snap: 5 })).toEqual(rect(0, 0, 120, 90));
		// 幅 93 → 1:1（90 × 90）に吸着。左の辺を動かしたときは右の辺を保つ
		expect(dragRect(start, 'w', 7, 0, bounds, { snap: 5 })).toEqual(rect(10, 0, 90, 90));
		// 遠いときは吸着させない
		expect(dragRect(start, 'e', 10, 0, bounds, { snap: 5 })).toEqual(rect(0, 0, 110, 90));
		// 高さ 58 → 16:9（100 × 56）に吸着。上の辺を動かしたときは下の辺を保つ
		expect(dragRect(start, 'n', 0, 32, bounds, { snap: 5 })).toEqual(rect(0, 34, 100, 56));
	});

	it('角では、ずらす量がいちばん小さい辺で吸着させる', () => {
		// 162 × 88: 幅を 156（16:9）にするより、高さを 91（16:9）にする方が近い
		expect(dragRect(rect(0, 0, 100, 50), 'se', 62, 38, bounds, { snap: 5 })).toEqual(
			rect(0, 0, 162, 91)
		);
	});

	it('吸着させると画像からはみ出すときは、吸着させない', () => {
		// 幅 398 × 300 → 4:3 は 400 × 300 で収まる
		expect(dragRect(rect(0, 0, 390, 300), 'e', 8, 0, bounds, { snap: 5 })).toEqual(
			rect(0, 0, 400, 300)
		);
		// 幅 285 × 300 → 1:1 にするには幅 300 が要るが、左の辺の位置（110）からだとはみ出す
		expect(dragRect(rect(110, 0, 280, 300), 'e', 5, 0, bounds, { snap: 20 })).toEqual(
			rect(110, 0, 285, 300)
		);
	});
});

describe('aspectLabel', () => {
	it('縦横比にちょうど合う範囲は、その比の名前を返す', () => {
		expect(aspectLabel(rect(0, 0, 90, 90))).toBe('1:1');
		expect(aspectLabel(rect(0, 0, 120, 90))).toBe('4:3');
		expect(aspectLabel(rect(0, 0, 90, 120))).toBe('3:4');
		expect(aspectLabel(rect(0, 0, 100, 56))).toBe('16:9');
		expect(aspectLabel(rect(0, 0, 56, 100))).toBe('9:16');
		expect(aspectLabel(rect(0, 0, 110, 90))).toBeNull();
	});

	it('複数の比に合うときは、いちばん近い比にする', () => {
		expect(aspectLabel(rect(0, 0, 1, 1))).toBe('1:1');
		expect(aspectLabel(rect(0, 0, 2, 1))).toBe('16:9');
	});
});

describe('fullRect / isFullRect', () => {
	it('画像全体の範囲かどうかを判定する', () => {
		expect(isFullRect(fullRect(bounds), bounds)).toBe(true);
		expect(isFullRect(rect(0, 0, 399, 300), bounds)).toBe(false);
	});
});

describe('cropPixels', () => {
	it('範囲の画素だけを切り出す', () => {
		const width = 4;
		const height = 3;
		const data = new Uint8ClampedArray(width * height * 4);
		for (let i = 0; i < width * height; i++) data.set([i, 0, 0, 255], i * 4);
		const out = cropPixels({ width, height, data }, rect(1, 1, 2, 2));
		expect(out.width).toBe(2);
		expect(out.height).toBe(2);
		expect([...out.data].filter((_, i) => i % 4 == 0)).toEqual([5, 6, 9, 10]);
	});
});
