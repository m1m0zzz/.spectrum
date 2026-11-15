// 動画の書き出し設定と、それに対応する ffmpeg の出力引数

export const videoFormats = ['mp4', 'webm'] as const;
export type VideoFormat = (typeof videoFormats)[number];

export const qualities = ['high', 'medium', 'low'] as const;
export type Quality = (typeof qualities)[number];

export const speeds = ['fast', 'normal', 'slow'] as const;
export type Speed = (typeof speeds)[number];

// 書き出し方法。fast は曲を再生せずに描いて WebCodecs でエンコードする（offlineExport.ts）。
// realtime は曲を再生しながら canvas を録画し、ffmpeg で変換する
export const exportMethods = ['fast', 'realtime'] as const;
export type ExportMethod = (typeof exportMethods)[number];

export const frameRates = [24, 30, 60] as const;
export const audioBitrates = [128, 192, 256, 320] as const;

export type EncodeSettings = {
  method: ExportMethod;
  format: VideoFormat;
  quality: Quality;
  speed: Speed;
  fps: number;
  audioBitrate: number; // kbps
};

export const defaultEncodeSettings: EncodeSettings = {
  method: 'fast',
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

// ffmpeg のログ（進み具合の行の「time=00:01:02.50」）から、書き出し済みの長さ（秒）を読む。
// -ss を -i の後ろに置いているため、time は出力の先頭からの時間になる。該当しない行は null。
// 組み込みの progress イベントは入力の長さで割るが、MediaRecorder の WebM は長さを持たないため使わない
export const parseProgressTime = (message: string): number | null => {
  const match = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(message);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
};

// 高速書き出し（WebCodecs）の映像ビットレート。最終的な出力になるため、録画時より低めにとる。
// ドット絵は平らな面が多く、ビットレートを抑えても崩れにくい
const FAST_BITS_PER_PIXEL: Record<Quality, number> = { high: 0.15, medium: 0.08, low: 0.04 };
export const fastVideoBitrate = (width: number, height: number, settings: EncodeSettings) => {
  const bps = width * height * settings.fps * FAST_BITS_PER_PIXEL[settings.quality];
  return Math.round(Math.min(Math.max(bps, 1_000_000), 20_000_000));
};

// H.264 は 4:2:0 のため、幅・高さを偶数に切り捨てる（ffmpeg で変換するときと同じ）
export const evenSize = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

// WebCodecs に渡す H.264 のコーデック文字列の候補。画面の大きさ（マクロブロック数）に足りるレベルを選び、
// プロファイルは High → Main → Constrained Baseline の順に試す
export const avcCodecCandidates = (width: number, height: number) => {
  const macroblocks = Math.ceil(width / 16) * Math.ceil(height / 16);
  // 4.0（1920×1080 まで）、5.1（4096×2304 まで）、6.2（8192×4320 まで）
  const level = macroblocks <= 8192 ? '28' : macroblocks <= 36864 ? '33' : '3E';
  return ['6400', '4D40', '42E0'].map((profile) => `avc1.${profile}${level}`);
};

// VP8 の生のフレームを IVF にまとめる（ffmpeg が読める、いちばん簡単な入れ物）。
// タイムベースは 1 / fps で、フレームの番号をそのままタイムスタンプにする
export const writeIvf = (frames: Uint8Array[], width: number, height: number, fps: number) => {
  const size = 32 + frames.reduce((sum, f) => sum + 12 + f.byteLength, 0);
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  out.set([0x44, 0x4b, 0x49, 0x46], 0); // 'DKIF'
  view.setUint16(4, 0, true); // version
  view.setUint16(6, 32, true); // header size
  out.set([0x56, 0x50, 0x38, 0x30], 8); // 'VP80'
  view.setUint16(12, width, true);
  view.setUint16(14, height, true);
  view.setUint32(16, fps, true); // timebase denominator
  view.setUint32(20, 1, true); // timebase numerator
  view.setUint32(24, frames.length, true);
  let offset = 32;
  frames.forEach((frame, i) => {
    view.setUint32(offset, frame.byteLength, true);
    view.setBigUint64(offset + 4, BigInt(i), true);
    out.set(frame, offset + 12);
    offset += 12 + frame.byteLength;
  });
  return out;
};

// 高速書き出しで、エンコード済みの映像（H.264 / IVF）と元の曲を 1 つにまとめる引数。
// 映像はそのまま写し（-c:v copy）、音声だけを範囲で切り出してエンコードする。
// 音声の -ss / -t は入力側に置く。曲のファイルはデコードしながら正確に位置を合わせられる
export const buildMuxArgs = (
  settings: EncodeSettings,
  videoName: string,
  audioName: string,
  trim: Trim,
  outputName: string
): string[] => {
  const video =
    settings.format == 'mp4'
      ? // 生の H.264 はタイムスタンプを持たないため、フレームレートを与えて振り直す
        ['-fflags', '+genpts', '-r', String(settings.fps), '-i', videoName]
      : ['-i', videoName];
  const audio =
    settings.format == 'mp4'
      ? ['-c:a', 'aac', '-b:a', `${settings.audioBitrate}k`, '-movflags', '+faststart']
      : ['-c:a', 'libvorbis', '-b:a', `${settings.audioBitrate}k`];
  return [
    ...video,
    '-ss',
    trim.start.toFixed(3),
    '-t',
    trim.duration.toFixed(3),
    '-i',
    audioName,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    // 録画（MediaRecorder）と同じ 48kHz にそろえる。曲が 22.05kHz などだと、Vorbis は高いビットレートを受け付けない
    '-ar',
    '48000',
    ...audio,
    outputName
  ];
};
