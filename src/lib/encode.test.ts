import { describe, expect, it } from 'vitest';
import {
  avcCodecCandidates,
  buildMuxArgs,
  buildOutputArgs,
  defaultEncodeSettings,
  evenSize,
  fastVideoBitrate,
  parseProgressTime,
  recordingVideoBitrate,
  writeIvf
} from './encode.ts';

const valueOf = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe('buildOutputArgs', () => {
  it('既定は H.264 / AAC の MP4 を 30fps で書き出す', () => {
    const args = buildOutputArgs(defaultEncodeSettings);
    expect(valueOf(args, '-c:v')).toBe('libx264');
    expect(valueOf(args, '-c:a')).toBe('aac');
    expect(valueOf(args, '-preset')).toBe('veryfast');
    expect(valueOf(args, '-crf')).toBe('23');
    expect(valueOf(args, '-r')).toBe('30');
    expect(valueOf(args, '-pix_fmt')).toBe('yuv420p');
    // 奇数の幅・高さを偶数に丸める
    expect(valueOf(args, '-vf')).toContain('trunc(iw/2)*2');
    expect(args).not.toContain('-ss');
  });

  it('範囲を指定すると -ss / -t を付ける', () => {
    const args = buildOutputArgs(defaultEncodeSettings, { start: 0.1234, duration: 12.5 });
    expect(valueOf(args, '-ss')).toBe('0.123');
    expect(valueOf(args, '-t')).toBe('12.500');
  });

  it('WebM は VP8 / Vorbis', () => {
    const args = buildOutputArgs({
      ...defaultEncodeSettings,
      format: 'webm',
      quality: 'high',
      fps: 60,
      audioBitrate: 320
    });
    expect(valueOf(args, '-c:v')).toBe('libvpx');
    expect(valueOf(args, '-c:a')).toBe('libvorbis');
    expect(valueOf(args, '-b:a')).toBe('320k');
    expect(valueOf(args, '-r')).toBe('60');
  });
});

describe('recordingVideoBitrate', () => {
  it('小さい画面でもブラウザの既定（2.5Mbps）を下回らず、大きい画面でも 16Mbps を超えない', () => {
    expect(recordingVideoBitrate(320, 320, defaultEncodeSettings)).toBe(2_500_000);
    const high = { ...defaultEncodeSettings, quality: 'high' as const, fps: 60 };
    expect(recordingVideoBitrate(1920, 1080, high)).toBe(16_000_000);
  });
});

describe('parseProgressTime', () => {
  it('reads time= from a progress line', () => {
    expect(
      parseProgressTime(
        'frame=  150 fps= 30 q=28.0 size=     256kB time=00:01:02.50 bitrate= 33.5kbits/s speed=1.2x'
      )
    ).toBeCloseTo(62.5);
    expect(parseProgressTime('size=0kB time=01:00:00.00 bitrate=N/A')).toBe(3600);
  });

  it('returns null for other lines and unknown time', () => {
    expect(parseProgressTime("Input #0, matroska,webm, from 'video':")).toBeNull();
    expect(parseProgressTime('size=0kB time=N/A bitrate=N/A')).toBeNull();
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

describe('fastVideoBitrate', () => {
  it('画質ごとに 1 ピクセルあたりのビット数を変え、上下限に収める', () => {
    const at = (quality: 'high' | 'medium' | 'low', w = 1440, h = 1080) =>
      fastVideoBitrate(w, h, { ...defaultEncodeSettings, quality });
    expect(at('high')).toBeGreaterThan(at('medium'));
    expect(at('medium')).toBeGreaterThan(at('low'));
    expect(at('low', 16, 16)).toBe(1_000_000);
    expect(at('high', 7680, 4320)).toBe(20_000_000);
  });
});

describe('writeIvf', () => {
  it('32 バイトのヘッダーと、フレームごとに 12 バイトのヘッダーを付ける', () => {
    const out = writeIvf([new Uint8Array([1, 2, 3]), new Uint8Array([4])], 320, 240, 30);
    const view = new DataView(out.buffer);
    expect(new TextDecoder().decode(out.slice(0, 4))).toBe('DKIF');
    expect(new TextDecoder().decode(out.slice(8, 12))).toBe('VP80');
    expect([view.getUint16(12, true), view.getUint16(14, true)]).toEqual([320, 240]);
    expect([view.getUint32(16, true), view.getUint32(20, true)]).toEqual([30, 1]);
    expect(view.getUint32(24, true)).toBe(2);
    // 1 つ目のフレーム: 大きさ 3、タイムスタンプ 0
    expect(view.getUint32(32, true)).toBe(3);
    expect(view.getBigUint64(36, true)).toBe(0n);
    expect([...out.slice(44, 47)]).toEqual([1, 2, 3]);
    // 2 つ目のフレーム: 大きさ 1、タイムスタンプ 1
    expect(view.getUint32(47, true)).toBe(1);
    expect(view.getBigUint64(51, true)).toBe(1n);
    expect(out[59]).toBe(4);
    expect(out.byteLength).toBe(60);
  });
});

describe('buildMuxArgs', () => {
  const trim = { start: 1.5, duration: 10 };

  it('MP4 は生の H.264 にフレームレートを与え、映像を写して音声を AAC にする', () => {
    const args = buildMuxArgs(defaultEncodeSettings, 'video.h264', 'audio', trim, 'out.mp4');
    expect(args.slice(0, 6)).toEqual(['-fflags', '+genpts', '-r', '30', '-i', 'video.h264']);
    // 音声の範囲は、音声の入力の前に置く
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('audio'));
    expect(valueOf(args, '-ss')).toBe('1.500');
    expect(valueOf(args, '-t')).toBe('10.000');
    expect(valueOf(args, '-c:v')).toBe('copy');
    expect(valueOf(args, '-c:a')).toBe('aac');
    expect(valueOf(args, '-ar')).toBe('48000');
    expect(args.at(-1)).toBe('out.mp4');
  });

  it('WebM は IVF をそのまま読み、音声を Vorbis にする', () => {
    const settings = { ...defaultEncodeSettings, format: 'webm' as const, audioBitrate: 320 };
    const args = buildMuxArgs(settings, 'video.ivf', 'audio', trim, 'out.webm');
    expect(args.slice(0, 2)).toEqual(['-i', 'video.ivf']);
    expect(valueOf(args, '-c:a')).toBe('libvorbis');
    expect(valueOf(args, '-b:a')).toBe('320k');
  });
});
