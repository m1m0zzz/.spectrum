import { describe, expect, it } from 'vitest';
import {
  avcCodecCandidates,
  codecsOf,
  defaultEncodeSettings,
  evenSize,
  recordingVideoBitrate,
  videoBitrate
} from './encode.ts';

describe('codecsOf', () => {
  it('MP4 は H.264 / AAC、WebM は VP8 / Opus', () => {
    expect(codecsOf('mp4')).toEqual({ video: 'avc', audio: 'aac' });
    expect(codecsOf('webm')).toEqual({ video: 'vp8', audio: 'opus' });
  });
});

describe('recordingVideoBitrate', () => {
  it('小さい画面でもブラウザの既定（2.5Mbps）を下回らず、大きい画面でも 16Mbps を超えない', () => {
    expect(recordingVideoBitrate(320, 320, defaultEncodeSettings)).toBe(2_500_000);
    const high = { ...defaultEncodeSettings, quality: 'high' as const, fps: 60 };
    expect(recordingVideoBitrate(1920, 1080, high)).toBe(16_000_000);
  });
});

describe('evenSize', () => {
  it('偶数に切り捨て、2 未満にはしない', () => {
    expect(evenSize(427)).toBe(426);
    expect(evenSize(240)).toBe(240);
    expect(evenSize(1)).toBe(2);
  });
});

describe('avcCodecCandidates', () => {
  it('大きさに足りるレベルを選び、High → Main → Baseline の順に並べる', () => {
    expect(avcCodecCandidates(1920, 1080)).toEqual(['avc1.640028', 'avc1.4D4028', 'avc1.42E028']);
    expect(avcCodecCandidates(2560, 1440)[0]).toBe('avc1.640033');
    expect(avcCodecCandidates(7680, 4320)[0]).toBe('avc1.64003E');
  });
});

describe('videoBitrate', () => {
  it('画質ごとに 1 ピクセルあたりのビット数を変え、上下限に収める', () => {
    const at = (quality: 'high' | 'medium' | 'low', w = 1440, h = 1080) =>
      videoBitrate(w, h, { ...defaultEncodeSettings, quality });
    expect(at('high')).toBeGreaterThan(at('medium'));
    expect(at('medium')).toBeGreaterThan(at('low'));
    expect(at('low', 16, 16)).toBe(1_000_000);
    expect(at('high', 7680, 4320)).toBe(20_000_000);
  });
});
