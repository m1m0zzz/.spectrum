// 動画の高速書き出し。曲を再生せずに、OfflineAudioContext で曲を解析しながら 1 フレームずつ描き、
// WebCodecs（VideoEncoder）でエンコードする。曲の長さを待たずに済み、画面に出していなくても進む。
// 音声は元の曲を ffmpeg で切り出してまとめる（ffmpeg.ts の muxVideo）
import {
  avcCodecCandidates,
  evenSize,
  fastVideoBitrate,
  videoFormats,
  writeIvf,
  type EncodeSettings,
  type VideoFormat
} from './encode.ts';
import { ANALYSER_SMOOTHING, SpectrumRenderer, type SpectrumStyle } from './spectrumRenderer.ts';

export type EncodedVideo = { data: Uint8Array; name: string };

// 一度にエンコーダーへ積んでおくフレームの数。多いとメモリを食い、少ないと待ちが増える
const MAX_QUEUE = 8;
// 曲を解析する（AnalyserNode を読む）回数（回/秒）。AnalyserNode の平滑化は読むたびにかかるため、
// 画面のプレビュー（一般的なディスプレイで 60 回/秒）と同じ頻度で読み、動きの速さをそろえる。
// 動画の各フレームは、その時点までに読んだ最後の結果で描く
const ANALYSIS_RATE = 60;
// キーフレームの間隔（秒）。シークしやすさとファイルの大きさの兼ね合い
const KEYFRAME_INTERVAL = 2;

// 高速書き出しに要る API（WebCodecs、OfflineAudioContext、OffscreenCanvas）があるか
const hasFastExportApis = () =>
  typeof VideoEncoder != 'undefined' &&
  typeof VideoFrame != 'undefined' &&
  typeof OfflineAudioContext != 'undefined' &&
  typeof OffscreenCanvas != 'undefined';

// 画面を開いたときに、高速書き出しを使える形式を調べる。実際の大きさで使えるかは書き出すときにも確かめ、
// 使えなければリアルタイムの録画に切り替える（大きすぎてハードウェアのエンコーダーが受け付けないときなど）
const PROBE_SIZE = { width: 640, height: 360 };
export const detectFastFormats = async (settings: EncodeSettings) => {
  const formats = new Set<VideoFormat>();
  for (const format of videoFormats) {
    const config = await findEncoderConfig(PROBE_SIZE.width, PROBE_SIZE.height, {
      ...settings,
      format
    });
    if (config) formats.add(format);
  }
  return formats;
};

// この環境で高速書き出しに使えるエンコーダーの設定。使えないときは null
export const findEncoderConfig = async (
  width: number,
  height: number,
  settings: EncodeSettings
): Promise<VideoEncoderConfig | null> => {
  if (!hasFastExportApis()) return null;
  const w = evenSize(width);
  const h = evenSize(height);
  const base = {
    width: w,
    height: h,
    bitrate: fastVideoBitrate(w, h, settings),
    framerate: settings.fps,
    latencyMode: 'quality' as const
  };
  const configs: VideoEncoderConfig[] =
    settings.format == 'mp4'
      ? avcCodecCandidates(w, h).map((codec) => ({
          ...base,
          codec,
          avc: { format: 'annexb' as const }
        }))
      : [{ ...base, codec: 'vp8' }];
  for (const config of configs) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported(config);
      if (supported) return config;
    } catch {
      // 形式の誤りなどで例外になる候補は飛ばす
    }
  }
  return null;
};

type RenderOptions = {
  config: VideoEncoderConfig;
  settings: EncodeSettings;
  // 曲。デコードは画面のプレビューと同じ AudioContext で行い、標本化周波数（＝ビンの周波数）をそろえる
  audioFile: File;
  audioContext: BaseAudioContext;
  fftSize: number;
  image: ImageData;
  style: SpectrumStyle;
  start: number;
  duration: number;
  onProgress?: (ratio: number) => void;
};

// エンコーダーに積んだフレームが MAX_QUEUE を下回るまで待つ
const waitForQueue = (encoder: VideoEncoder) =>
  new Promise<void>((resolve) => {
    if (encoder.encodeQueueSize <= MAX_QUEUE) return resolve();
    // dequeue イベントの無いブラウザでは少しずつ待つ
    if (!('ondequeue' in encoder)) return setTimeout(resolve, 1);
    encoder.addEventListener('dequeue', () => resolve(), { once: true });
  });

export const renderVideo = async (options: RenderOptions): Promise<EncodedVideo> => {
  const { config, settings, image, style, start, duration, onProgress } = options;
  const { fps } = settings;
  const width = config.width;
  const height = config.height;

  const buffer = await options.audioContext.decodeAudioData(await options.audioFile.arrayBuffer());
  const sampleRate = buffer.sampleRate;
  // 出力は使わない（解析だけする）ため 1 チャンネルにしてメモリを抑える
  const offline = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(duration * sampleRate)),
    sampleRate
  );
  const source = offline.createBufferSource();
  source.buffer = buffer;
  const analyser = offline.createAnalyser();
  analyser.fftSize = options.fftSize;
  analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;
  source.connect(analyser);
  analyser.connect(offline.destination);
  source.start(0, start, duration);

  const canvas = new OffscreenCanvas(width, height);
  const renderer = new SpectrumRenderer(canvas.getContext('2d', { alpha: false })!);

  const chunks: Uint8Array[] = [];
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      chunks.push(data);
    },
    error: (error) => (failure ??= error)
  });
  encoder.configure(config);

  // 範囲の最後のフレームが範囲内に収まるようにする（suspend は曲の長さ未満の時刻しか受け付けない）
  const total = Math.max(1, Math.ceil(duration * fps - 1e-6));
  const frameDuration = 1e6 / fps;
  const keyFrameEvery = Math.max(1, Math.round(fps * KEYFRAME_INTERVAL));

  // 最後に読んだ解析結果をコピーして持つ（readLevels の配列は次に読むと上書きされる）
  let levels = new Float32Array(image.width);
  let next = 0; // 次に描くフレーム
  const renderFrame = async (i: number) => {
    renderer.drawLevels(levels, image, style, i == 0 ? 0 : 1000 / fps);
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round(i * frameDuration),
      duration: Math.round(frameDuration)
    });
    encoder.encode(frame, { keyFrame: i % keyFrameEvery == 0 });
    frame.close();
    await waitForQueue(encoder);
    onProgress?.((i + 1) / total);
  };

  // 今の時点（そこまでの音）を解析し、until 秒（次の解析）より前に来るフレームを描く
  const analyse = async (until: number, read = true) => {
    if (failure) return;
    try {
      if (read) levels = renderer.readLevels(analyser, image.width).slice();
      for (; next < total && next / fps < until; next++) await renderFrame(next);
    } catch (error) {
      failure ??= error;
    }
  };

  // 0 秒の解析は、まだ音が無いので描き始める前に行う
  const steps = Math.ceil(duration * ANALYSIS_RATE);
  for (let k = 1; k < steps; k++) {
    offline.suspend(k / ANALYSIS_RATE).then(
      async () => {
        await analyse((k + 1) / ANALYSIS_RATE);
        offline.resume();
      },
      (error) => (failure ??= error)
    );
  }
  await analyse(steps > 1 ? 1 / ANALYSIS_RATE : Infinity);
  await offline.startRendering();
  // 残ったフレームがあれば（丸めの誤差で）、最後の解析結果で描く
  await analyse(Infinity, false);
  if (!failure) await encoder.flush().catch((error) => (failure ??= error));
  if (encoder.state != 'closed') encoder.close();
  if (failure) throw failure;

  if (settings.format == 'mp4') {
    const data = new Uint8Array(chunks.reduce((sum, c) => sum + c.byteLength, 0));
    let offset = 0;
    for (const c of chunks) {
      data.set(c, offset);
      offset += c.byteLength;
    }
    return { data, name: 'video.h264' };
  }
  return { data: writeIvf(chunks, width, height, fps), name: 'video.ivf' };
};
