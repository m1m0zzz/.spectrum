import { describe, expect, it } from 'vitest';
import { buildOutputArgs, defaultEncodeSettings, recordingVideoBitrate } from './encode.ts';

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
