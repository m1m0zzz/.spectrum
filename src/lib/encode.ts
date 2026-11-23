// 動画の書き出し設定と、エンコードの細かい値（コーデック・ビットレートなど）

export const videoFormats = ['mp4', 'webm'] as const;
export type VideoFormat = (typeof videoFormats)[number];

export const qualities = ['high', 'medium', 'low'] as const;
export type Quality = (typeof qualities)[number];

// 書き出し方法。fast は曲を再生せずに描いてエンコードする（offlineExport.ts）。
// realtime は曲を再生しながら canvas を録画し、Mediabunny で変換する（mux.ts）
export const exportMethods = ['fast', 'realtime'] as const;
export type ExportMethod = (typeof exportMethods)[number];

export const frameRates = [24, 30, 60] as const;
export const audioBitrates = [128, 192, 256, 320] as const;

export type EncodeSettings = {
  method: ExportMethod;
  format: VideoFormat;
  quality: Quality;
  fps: number;
  audioBitrate: number; // kbps
};

export const defaultEncodeSettings: EncodeSettings = {
  method: 'fast',
  format: 'mp4',
  quality: 'medium',
  fps: 30,
  audioBitrate: 192
};

// 形式ごとのコーデック（Mediabunny の名前）。MP4 は H.264 / AAC、WebM は VP8 / Opus
export const codecsOf = (format: VideoFormat) =>
  format == 'mp4'
    ? ({ video: 'avc', audio: 'aac' } as const)
    : ({ video: 'vp8', audio: 'opus' } as const);

// 書き出す音声はすべて 48kHz にそろえる。Opus は 48kHz でしかエンコードできず、AAC もこれで困らない
export const AUDIO_SAMPLE_RATE = 48000;

// 録画した動画のどこを書き出すか（秒）
export type Trim = { start: number; duration: number };

export const mimeTypeOf = (format: VideoFormat) => `video/${format}`;

// 録画（MediaRecorder）時の映像ビットレート。ここで画質が落ちると変換後も戻らないため、
// ブラウザの既定（Chrome で 2.5Mbps）より高めにとる。上限はメモリ（変換するときに録画を丸ごと読み込む）との兼ね合い
const BITS_PER_PIXEL: Record<Quality, number> = { high: 0.3, medium: 0.15, low: 0.08 };
export const recordingVideoBitrate = (width: number, height: number, settings: EncodeSettings) => {
  const bps = width * height * settings.fps * BITS_PER_PIXEL[settings.quality];
  return Math.round(Math.min(Math.max(bps, 2_500_000), 16_000_000));
};

// 書き出す動画の映像ビットレート（高速書き出しと、録画を変換するときの両方）。録画時より低めにとる。
// ドット絵は平らな面が多く、ビットレートを抑えても崩れにくい
const VIDEO_BITS_PER_PIXEL: Record<Quality, number> = { high: 0.15, medium: 0.08, low: 0.04 };
export const videoBitrate = (width: number, height: number, settings: EncodeSettings) => {
  const bps = width * height * settings.fps * VIDEO_BITS_PER_PIXEL[settings.quality];
  return Math.round(Math.min(Math.max(bps, 1_000_000), 20_000_000));
};

// H.264 は 4:2:0 のため、幅・高さを偶数に切り捨てる
export const evenSize = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

// H.264 のレベル（4.0 以上）。[コーデック文字列での値, 1 フレームの最大マクロブロック数, 1 秒の最大マクロブロック数]
const AVC_LEVELS: [string, number, number][] = [
  ['28', 8192, 245_760], // 4.0
  ['2A', 8704, 522_240], // 4.2
  ['32', 22_080, 589_824], // 5.0
  ['33', 36_864, 983_040], // 5.1
  ['34', 36_864, 2_073_600], // 5.2
  ['3C', 139_264, 4_177_920], // 6.0
  ['3D', 139_264, 8_355_840], // 6.1
  ['3E', 139_264, 16_711_680] // 6.2
];

// WebCodecs に渡す H.264 のコーデック文字列の候補。画面の大きさとフレームレート（1 秒あたりのマクロブロック数）に
// 足りるレベルを選ぶ。大きさだけで選ぶと 1080p・60fps などで上限を超え、レベルを守るエンコーダーに断られる。
// プロファイルは High → Main → Constrained Baseline の順に試す
export const avcCodecCandidates = (width: number, height: number, fps: number) => {
  const macroblocks = Math.ceil(width / 16) * Math.ceil(height / 16);
  const level =
    AVC_LEVELS.find(([, frame, rate]) => macroblocks <= frame && macroblocks * fps <= rate)?.[0] ??
    '3E';
  return ['6400', '4D40', '42E0'].map((profile) => `avc1.${profile}${level}`);
};
