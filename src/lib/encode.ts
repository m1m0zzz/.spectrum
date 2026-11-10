// 動画の書き出し設定と、それに対応する ffmpeg の出力引数

export const videoFormats = ['mp4', 'webm'] as const;
export type VideoFormat = (typeof videoFormats)[number];

export const qualities = ['high', 'medium', 'low'] as const;
export type Quality = (typeof qualities)[number];

export const speeds = ['fast', 'normal', 'slow'] as const;
export type Speed = (typeof speeds)[number];

export const frameRates = [24, 30, 60] as const;
export const audioBitrates = [128, 192, 256, 320] as const;

export type EncodeSettings = {
	format: VideoFormat;
	quality: Quality;
	speed: Speed;
	fps: number;
	audioBitrate: number; // kbps
};

export const defaultEncodeSettings: EncodeSettings = {
	format: 'mp4',
	quality: 'medium',
	speed: 'normal',
	fps: 30,
	audioBitrate: 192
};

// 録画した WebM のどこを書き出すか（秒）
export type Trim = { start: number; duration: number };

export const mimeTypeOf = (format: VideoFormat) => `video/${format}`;

const X264_CRF: Record<Quality, number> = { high: 18, medium: 23, low: 28 };
// ブラウザ内（wasm）では x264 の既定（medium）だと遅いため、標準を veryfast にする
const X264_PRESET: Record<Speed, string> = {
	fast: 'ultrafast',
	normal: 'veryfast',
	slow: 'medium'
};
// VP8 の crf は -b:v を上限とした画質の目安（4〜63、小さいほど高画質）
const VP8_CRF: Record<Quality, number> = { high: 6, medium: 10, low: 20 };
const VP8_CPU_USED: Record<Speed, number> = { fast: 8, normal: 4, slow: 2 };

// 出力側の引数（-i の後ろ、出力ファイル名の前に置く）
export const buildOutputArgs = (settings: EncodeSettings, trim?: Trim): string[] => {
	const args: string[] = [];
	if (trim) {
		// -i の後ろに置くと、デコードしてから捨てるので位置が正確になる。
		// MediaRecorder の WebM は索引を持たず、入力側のシークは当てにならない
		args.push('-ss', trim.start.toFixed(3), '-t', trim.duration.toFixed(3));
	}

	if (settings.format == 'mp4') {
		args.push(
			'-c:v',
			'libx264',
			'-preset',
			X264_PRESET[settings.speed],
			'-crf',
			String(X264_CRF[settings.quality]),
			// libx264 の yuv420p は幅・高さが奇数だと失敗する（427×240 など）。偶数に切り捨て、
			// ドットがにじまないよう最近傍で縮める
			'-vf',
			'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=neighbor',
			'-pix_fmt',
			'yuv420p',
			'-c:a',
			'aac',
			'-b:a',
			`${settings.audioBitrate}k`,
			// 先頭に索引を置き、ダウンロードしきる前から再生できるようにする
			'-movflags',
			'+faststart'
		);
	} else {
		// 同梱のコア（ffmpeg.wasm 0.12）では libvpx-vp9 が「memory access out of bounds」で落ち、
		// libopus もステレオ音声でタブごと落ちる。そのため VP8 / Vorbis を使う
		args.push(
			'-c:v',
			'libvpx',
			'-crf',
			String(VP8_CRF[settings.quality]),
			'-b:v',
			'10M',
			'-deadline',
			'realtime',
			'-cpu-used',
			String(VP8_CPU_USED[settings.speed]),
			'-pix_fmt',
			'yuv420p',
			'-c:a',
			'libvorbis',
			'-b:a',
			`${settings.audioBitrate}k`
		);
	}

	// MediaRecorder の WebM は可変フレームレートで、フレームの間隔が揃わないと ffmpeg はタイムスタンプの単位（1ms）から
	// 1000fps と推定し、同じフレームを複製して 1000fps の動画を書き出す。出力のフレームレートを固定して防ぐ
	args.push('-r', String(settings.fps));
	return args;
};

// 録画（MediaRecorder）時の映像ビットレート。ここで画質が落ちると変換後も戻らないため、
// ブラウザの既定（Chrome で 2.5Mbps）より高めにとる。上限はメモリ（ffmpeg.wasm に丸ごと載る）との兼ね合い
const BITS_PER_PIXEL: Record<Quality, number> = { high: 0.3, medium: 0.15, low: 0.08 };
export const recordingVideoBitrate = (width: number, height: number, settings: EncodeSettings) => {
	const bps = width * height * settings.fps * BITS_PER_PIXEL[settings.quality];
	return Math.round(Math.min(Math.max(bps, 2_500_000), 16_000_000));
};
