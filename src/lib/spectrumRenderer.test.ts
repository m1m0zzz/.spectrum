import { describe, expect, it } from 'vitest';
import { analyserSmoothing } from './spectrumRenderer.ts';

describe('analyserSmoothing', () => {
  it('60 fps のときの値を基準に、1 秒あたりの減り方がフレームレートによらずそろう', () => {
    expect(analyserSmoothing(60)).toBeCloseTo(0.85);
    for (const fps of [24, 30, 60]) {
      expect(Math.pow(analyserSmoothing(fps), fps)).toBeCloseTo(Math.pow(0.85, 60));
    }
  });
});
