import { describe, expect, it } from 'vitest';
import { computePeaks, resamplePeaks } from './waveform.ts';

const f32 = (values: number[]) => Float32Array.from(values);

describe('computePeaks', () => {
  it('区間ごとに、全チャンネルの絶対値の最大をとる', () => {
    const left = f32([0.1, -0.5, 0.2, 0.0, 0.3, -0.1]);
    const right = f32([0.0, 0.2, -0.4, 0.1, 0.0, -0.9]);
    expect([...computePeaks([left, right], 3)]).toEqual([...f32([0.5, 0.4, 0.9])]);
  });

  it('区間がサンプルより多くても、どの区間も値を持つ', () => {
    expect([...computePeaks([f32([0.5, -1])], 4)]).toEqual([0.5, 0.5, 1, 1]);
  });

  it('音声が空なら 0 を返す', () => {
    expect([...computePeaks([new Float32Array(0)], 2)]).toEqual([0, 0]);
    expect([...computePeaks([], 2)]).toEqual([0, 0]);
  });
});

describe('resamplePeaks', () => {
  it('まとめるときは各区間の最大をとる', () => {
    expect([...resamplePeaks(f32([0.1, 0.5, 0.25, 0.125]), 2)]).toEqual([0.5, 0.25]);
  });

  it('増やすときは同じ値を繰り返す', () => {
    expect([...resamplePeaks(f32([0.5, 1]), 4)]).toEqual([0.5, 0.5, 1, 1]);
  });

  it('範囲を指定すると、その部分だけをまとめ直す', () => {
    const peaks = f32([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
    expect([...resamplePeaks(peaks, 2, 0.25, 0.75)]).toEqual([...f32([0.4, 0.6])]);
    // ズームして区間より細かくすると、同じ値を繰り返す
    expect([...resamplePeaks(peaks, 4, 0.5, 0.75)]).toEqual([...f32([0.5, 0.5, 0.6, 0.6])]);
    // 端を越えても、端の値で止める
    expect([...resamplePeaks(peaks, 2, 0.875, 1.125)]).toEqual([...f32([0.8, 0.8])]);
  });
});
