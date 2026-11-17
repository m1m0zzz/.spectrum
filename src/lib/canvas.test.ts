import { describe, expect, it } from 'vitest';
import {
  applySlope,
  computeBandLevels,
  createBandMap,
  createSlopeOffsets,
  SLOPE_PIVOT
} from './canvas.ts';

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

describe('createBandMap', () => {
  for (const [binCount, columns] of [
    [4096, 256],
    [4096, 64],
    [16384, 1024],
    [1024, 32],
    [2048, 600]
  ] as const) {
    it(`${binCount} bins -> ${columns} columns: 変更前と同じ割り当てで、列ごとに別のビンを持つ`, () => {
      const { begin, end } = createBandMap(binCount, columns);
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

  for (const [binCount, columns] of [
    [1024, 1500],
    [16, 320],
    [16, 15]
  ] as const) {
    it(`列がビンより多くても空の列を作らない（${binCount} bins -> ${columns} columns）`, () => {
      const { begin, end } = createBandMap(binCount, columns);
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
});

describe('computeBandLevels', () => {
  it('列が受け持つビンの平均をとる', () => {
    const freq = Uint8Array.from([10, 20, 30, 40, 50, 60, 70, 80]);
    const map = { begin: Uint32Array.from([0, 4]), end: Uint32Array.from([3, 7]) };
    expect([...computeBandLevels(freq, map, new Float32Array(2))]).toEqual([25, 65]);
  });
});

describe('createSlopeOffsets', () => {
  // 48 kHz・fftSize 96 だとビン i がちょうど i × 500 Hz になる
  const offsets = createSlopeOffsets(48, 48000, 3);

  it('中心の周波数で 0 dB、1 オクターブごとに slope dB 変わる', () => {
    expect(SLOPE_PIVOT).toBe(1000);
    expect(offsets[2]).toBeCloseTo(0); // 1 kHz
    expect(offsets[4]).toBeCloseTo(3); // 2 kHz
    expect(offsets[8]).toBeCloseTo(6); // 4 kHz
    expect(offsets[1]).toBeCloseTo(-3); // 500 Hz
  });

  it('直流は 0 dB のまま', () => {
    expect(offsets[0]).toBe(0);
  });
});

describe('applySlope', () => {
  it('dB にスロープを足してから getByteFrequencyData と同じ式で 0〜255 にする', () => {
    const decibels = Float32Array.from([-100, -65, -30, -65]);
    const offsets = Float32Array.from([0, 0, 0, 7]);
    const out = applySlope(decibels, offsets, -100, -30, new Uint8Array(4));
    expect([...out]).toEqual([0, 127, 255, 153]);
  });

  it('範囲の外は 0 と 255 に収め、無音（-Infinity）は持ち上げない', () => {
    const decibels = Float32Array.from([-Infinity, -120, -10]);
    const offsets = Float32Array.from([20, 10, 5]);
    const out = applySlope(decibels, offsets, -100, -30, new Uint8Array(3));
    expect([...out]).toEqual([0, 0, 255]);
  });
});
