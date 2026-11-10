import { describe, expect, it } from 'vitest';
import { computeBandLevels, createBandMap, createDistinctLogBandMap, minBinOf } from './index.ts';

const cases = [
	// [binCount, columns]
	[4096, 256],
	[4096, 1920],
	[1024, 1500], // 列がビンより多い
	[16, 320],
	[16384, 64]
] as const;

describe('createBandMap', () => {
	for (const scale of ['linear', 'log'] as const) {
		for (const [binCount, columns] of cases) {
			it(`${scale}: ${binCount} bins -> ${columns} columns に隙間も空の列も無い`, () => {
				const minBin = scale == 'log' ? minBinOf(binCount, 48000) : 1;
				const { begin, end } = createBandMap(binCount, columns, scale, minBin);
				expect(begin.length).toBe(columns);
				expect(end[columns - 1]).toBe(binCount - 1);
				for (let c = 0; c < columns; c++) {
					expect(begin[c]).toBeLessThanOrEqual(end[c]);
					expect(end[c]).toBeLessThan(binCount);
					if (c > 0) {
						// 左から右へ単調に進み、ビンを飛ばさない
						expect(begin[c]).toBeGreaterThanOrEqual(begin[c - 1]);
						expect(begin[c]).toBeLessThanOrEqual(end[c - 1] + 1);
					}
				}
			});
		}
	}

	it('linear はビン 0 から始まる', () => {
		expect(createBandMap(1024, 100, 'linear').begin[0]).toBe(0);
	});

	it('log は下端の周波数から始まり、対数で等間隔に割り当てる', () => {
		// 48kHz, fftSize 8192 -> 1 ビン約 5.86Hz。20Hz は約 3.4 ビン
		const minBin = minBinOf(4096, 48000);
		expect(minBin).toBeCloseTo(20 / (48000 / 8192), 5);
		const { begin } = createBandMap(4096, 120, 'log', minBin);
		expect(begin[0]).toBe(3);
		// 4096 / 3.4 ≒ 2^10.2 なので、1 オクターブ（ビンの位置が 2 倍）ごとにおよそ 120 / 10.2 列
		const perOctave = 120 / Math.log2(4096 / minBin);
		const c = Math.round(perOctave * 6);
		expect(begin[c] / minBin).toBeGreaterThan(2 ** 5.8);
		expect(begin[c] / minBin).toBeLessThan(2 ** 6.2);
	});
});

describe('computeBandLevels', () => {
	const freq = Uint8Array.from([10, 20, 30, 40, 50, 60, 70, 80]);
	const map = createBandMap(8, 2, 'linear'); // [0..3], [4..7]

	it('max は帯域の最大値', () => {
		expect([...computeBandLevels(freq, map, new Float32Array(2), 'max')]).toEqual([40, 80]);
	});

	it('avg は帯域の平均値', () => {
		expect([...computeBandLevels(freq, map, new Float32Array(2), 'avg')]).toEqual([25, 65]);
	});
});

// 変更前の generateLogToPixelIndexMap（列 0 が直流を含む点と、画像の幅がビンより多いと null の列ができる点以外は同じ割り当て）
const legacyMap = (binCount: number, width: number) => {
	const map = [...Array(width)].map(() => ({
		begin: null as number | null,
		end: null as number | null
	}));
	let count = 0;
	map[0].begin = 0;
	for (let i = 0; i < binCount; i++) {
		if (count + 1 < (Math.log(i) / Math.log(binCount)) * width) {
			map[count].end = i - 1;
			count++;
			map[count].begin = i;
			if (count >= width) break;
		}
	}
	if (!map[map.length - 1].end) map[map.length - 1].end = binCount - 1;
	return map;
};

describe('createDistinctLogBandMap', () => {
	for (const [binCount, columns] of [
		[4096, 256],
		[4096, 64],
		[16384, 1024],
		[1024, 32],
		[2048, 600]
	] as const) {
		it(`${binCount} bins -> ${columns} columns: 変更前と同じ割り当てで、列ごとに別のビンを持つ`, () => {
			const { begin, end } = createDistinctLogBandMap(binCount, columns);
			const legacy = legacyMap(binCount, columns);
			for (let c = 0; c < columns; c++) {
				expect(begin[c]).toBeLessThanOrEqual(end[c]);
				if (c > 0) {
					expect(begin[c]).toBe(end[c - 1] + 1);
					expect(begin[c]).toBe(legacy[c].begin);
				}
				expect(end[c]).toBe(legacy[c].end);
			}
			expect(begin[0]).toBe(1);
			expect(end[columns - 1]).toBe(binCount - 1);
		});
	}

	it('列がビンより多くても空の列を作らない', () => {
		const { begin, end } = createDistinctLogBandMap(1024, 1500);
		for (let c = 0; c < 1500; c++) {
			expect(begin[c]).toBeLessThanOrEqual(end[c]);
			expect(end[c]).toBeLessThan(1024);
		}
	});
});
