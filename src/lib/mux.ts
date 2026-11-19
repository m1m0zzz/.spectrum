// 動画ファイルの組み立てと変換（Mediabunny）。エンコードはブラウザの WebCodecs で行う。
// AAC はエンコードできないブラウザがある（Firefox・Linux のデスクトップ・Safari 26 より前）ため、
// そのときだけ FFmpeg の AAC エンコーダーの WASM（@mediabunny/aac-encoder）を読み込んで使う
import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  canEncodeAudio,
  canEncodeVideo,
  Conversion,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  type OutputFormat,
  WebMOutputFormat
} from 'mediabunny';
import {
  AUDIO_SAMPLE_RATE,
  codecsOf,
  evenSize,
  mimeTypeOf,
  videoBitrate,
  videoFormats,
  type EncodeSettings,
  type Trim,
  type VideoFormat
} from './encode.ts';

// 書き出す音声のチャンネル数。モノラルの曲も、ほかの曲と同じステレオにする
export const AUDIO_CHANNELS = 2;

export const audioQuality = (settings: EncodeSettings) =>
  new Quality({ bitrate: settings.audioBitrate * 1000 });

const audioOptions = (settings: EncodeSettings) => ({
  numberOfChannels: AUDIO_CHANNELS,
  sampleRate: AUDIO_SAMPLE_RATE,
  quality: audioQuality(settings)
});

let aacFallback: Promise<void> | undefined;

// AAC をエンコードできるようにする。ブラウザでできなければ WASM のエンコーダーを読み込んで登録する（約 290KB）。
// 登録すると、以降の AAC はすべてそれでエンコードする。読み込みに失敗したら次の呼び出しでやり直す
const ensureAacEncoder = async (settings: EncodeSettings) => {
  if (await canEncodeAudio('aac', audioOptions(settings))) return;
  aacFallback ??= import('@mediabunny/aac-encoder')
    .then(({ registerAacEncoder }) => registerAacEncoder())
    .catch((error) => {
      aacFallback = undefined;
      throw error;
    });
  await aacFallback;
};

// 書き出す音声をエンコードできるようにする。できないときは例外にする
export const ensureAudioEncoder = async (settings: EncodeSettings) => {
  const codec = codecsOf(settings.format).audio;
  if (codec == 'aac') return ensureAacEncoder(settings);
  if (!(await canEncodeAudio(codec, audioOptions(settings)))) {
    throw new Error(`cannot encode ${codec} audio`);
  }
};

// この環境で書き出せる形式。映像をエンコードでき、音声もエンコードできる（AAC は WASM で補える）ものを返す
export const detectExportFormats = async (settings: EncodeSettings) => {
  const formats = new Set<VideoFormat>();
  if (typeof VideoEncoder == 'undefined') return formats;
  for (const format of videoFormats) {
    const { video, audio } = codecsOf(format);
    const options = { ...settings, format };
    const ok =
      (await canEncodeVideo(video, { width: 640, height: 360, frameRate: settings.fps })) &&
      (audio == 'aac' || (await canEncodeAudio(audio, audioOptions(options))));
    if (ok) formats.add(format);
  }
  return formats;
};

// メモリ上に書き出す出力。MP4 は索引を先頭に置き、ダウンロードしきる前から再生できるようにする
export const createOutput = (format: VideoFormat) =>
  new Output({
    format:
      format == 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(),
    target: new BufferTarget()
  });

// 書き終えた出力を blob url にする
export const toBlobUrl = (output: Output<OutputFormat, BufferTarget>, format: VideoFormat) => {
  const buffer = output.target.buffer;
  if (!buffer) throw new Error('output is empty');
  return URL.createObjectURL(new Blob([buffer], { type: mimeTypeOf(format) }));
};

// 録画した動画（MediaRecorder の WebM、Safari では MP4）を、設定の形式に変換する。return: blob url。
// width / height は録画した canvas の大きさで、H.264 に合わせて偶数に切り詰める（縮めるとドットがにじむため、端を削る）
export const convertRecording = async (
  file: File,
  settings: EncodeSettings,
  trim: Trim,
  size: { width: number; height: number },
  onProgress?: (ratio: number) => void
) => {
  await ensureAudioEncoder(settings);
  const { video, audio } = codecsOf(settings.format);
  const width = evenSize(size.width);
  const height = evenSize(size.height);
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const output = createOutput(settings.format);
  try {
    const conversion = await Conversion.init({
      input,
      output,
      video: {
        codec: video,
        quality: new Quality({ bitrate: videoBitrate(width, height, settings) }),
        crop: { left: 0, top: 0, width, height },
        // MediaRecorder の録画はフレームの間隔がそろわない（可変フレームレート）ため、設定のフレームレートにそろえる
        frameRate: settings.fps
      },
      audio: { codec: audio, ...audioOptions(settings) },
      // 録画の開始から音が鳴り始めるまでの分を、先頭から削る
      trim: { start: trim.start, end: trim.start + trim.duration },
      showWarnings: false
    });
    // 映像か音声のどちらかでも使えないと、片方が抜けた動画になるため失敗にする
    if (!conversion.isValid || conversion.discardedTracks.length > 0) {
      const reasons = conversion.discardedTracks.map((t) => `${t.track.type}: ${t.reason}`);
      throw new Error(`cannot convert the recording (${reasons.join(', ') || 'invalid'})`);
    }
    if (onProgress) conversion.onProgress = (progress) => onProgress(progress);
    await conversion.execute();
    return toBlobUrl(output, settings.format);
  } finally {
    input.dispose();
  }
};
