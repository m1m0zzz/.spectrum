import { describe, expect, it } from 'vitest';
import { formatTime } from './util.ts';

describe('formatTime', () => {
  it('分:秒（秒は 2 桁）にし、秒は切り捨てる', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5.9)).toBe('0:05');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3600)).toBe('60:00');
  });

  it('負の値と有限でない値は 0 にする', () => {
    expect(formatTime(-3)).toBe('0:00');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
  });
});
