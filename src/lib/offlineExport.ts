// 動画の高速書き出し。曲を再生せずに、OfflineAudioContext で曲を解析しながら 1 フレームずつ描き、
// WebCodecs（VideoEncoder）でエンコードする。曲の長さを待たずに済み、画面に出していなくても進む。
// 音声は元の曲の範囲を切り出してエンコードし、Mediabunny で映像と 1 つのファイルにまとめる
import { AudioBufferSource, EncodedPacket, EncodedVideoPacketSource } from 'mediabunny';
import {
  AUDIO_SAMPLE_RATE,
  avcCodecCandidates,
  codecsOf,
  evenSize,
  videoBitrate,
  videoFormats,
  type EncodeSettings,
  type VideoFormat
} from './encode.ts';
import {
  AUDIO_CHANNELS,
  audioQuality,
  createOutput,
  ensureAudioEncoder,
  toBlobUrl
} from './mux.ts';
import { analyserSmoothing, SpectrumRenderer, type SpectrumStyle } from './spectrumRenderer.ts';

// 一度にエンコーダーへ積んでおくフレームの数。多いとメモリを食い、少ないと待ちが増える
const MAX_QUEUE = 8;
// キーフレームの間隔（秒）。シークしやすさとファイルの大きさの兼ね合い
const KEYFRAME_INTERVAL = 2;

// Firefox は WebCodecs を持つが OfflineAudioContext の suspend() が無く（解析のために 1/60 秒ごとに止めるのに使う）、
// 調べないと使えると判定して書き出しのたびに失敗する
const hasFastExportApis = () =>
  typeof VideoEncoder != 'undefined' &&
  typeof VideoFrame != 'undefined' &&
  typeof OfflineAudioContext != 'undefined' &&
  typeof OfflineAudioContext.prototype.suspend == 'function' &&
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
    bitrate: videoBitrate(w, h, settings),
    framerate: settings.fps,
    latencyMode: 'quality' as const
  };
  const configs: VideoEncoderConfig[] =
    settings.format == 'mp4'
      ? avcCodecCandidates(w, h, settings.fps).map((codec) => ({
          ...base,
          codec,
          // MP4 に入れるため、デコーダーの設定（description）を別に持つ形式にする
          avc: { format: 'avc' as const }
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
  // デコードした曲。画面のプレビューと同じ AudioContext でデコードしたもので、標本化周波数（＝ビンの周波数）がそろう
  audio: AudioBuffer;
  fftSize: number;
  image: ImageData;
  style: SpectrumStyle;
  start: number;
  duration: number;
  onProgress?: (ratio: number) => void;
};

// エンコーダーに積んだフレームが MAX_QUEUE を下回るまで待つ
const waitForQueue = async (encoder: VideoEncoder) => {
  while (encoder.encodeQueueSize > MAX_QUEUE) {
    await new Promise<void>((resolve) => {
      // dequeue イベントの無いブラウザでは少しずつ待つ
      if (!('ondequeue' in encoder)) return setTimeout(resolve, 1);
      encoder.addEventListener('dequeue', () => resolve(), { once: true });
    });
  }
};

// 書き出す範囲の音声を、48kHz・ステレオにして切り出す（モノラルの曲は左右に同じ音を入れる）
const renderAudioRange = (buffer: AudioBuffer, start: number, duration: number) => {
  const context = new OfflineAudioContext(
    AUDIO_CHANNELS,
    Math.max(1, Math.ceil(duration * AUDIO_SAMPLE_RATE)),
    AUDIO_SAMPLE_RATE
  );
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start(0, start, duration);
  return context.startRendering();
};

// 映像を描いてエンコードし、曲の範囲と 1 つの動画ファイルにまとめる。return: blob url
export const renderVideo = async (options: RenderOptions): Promise<string> => {
  const { config, settings, image, style, start, duration, onProgress } = options;
  const { fps } = settings;
  const width = config.width;
  const height = config.height;

  const buffer = options.audio;
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
  analyser.smoothingTimeConstant = analyserSmoothing(fps);
  source.connect(analyser);
  analyser.connect(offline.destination);
  source.start(0, start, duration);

  const canvas = new OffscreenCanvas(width, height);
  const renderer = new SpectrumRenderer(canvas.getContext('2d', { alpha: false })!);

  await ensureAudioEncoder(settings);
  const audio = await renderAudioRange(buffer, start, duration);
  const codecs = codecsOf(settings.format);
  const output = createOutput(settings.format);
  const videoSource = new EncodedVideoPacketSource(codecs.video);
  const audioSource = new AudioBufferSource({
    codec: codecs.audio,
    quality: audioQuality(settings)
  });
  output.addVideoTrack(videoSource, { frameRate: fps });
  output.addAudioTrack(audioSource);
  await output.start();

  let failure: unknown = null;
  // 音声は映像と並べてエンコードする（どちらかを待つと、ファイルに書く順をそろえるところで止まる）
  const audioDone = audioSource
    .add(audio)
    .then(() => audioSource.close())
    .catch((error) => (failure ??= error));
  // エンコードされた映像は、出た順（デコード順）にファイルへ渡す
  let videoDone = Promise.resolve();
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const packet = EncodedPacket.fromEncodedChunk(chunk);
      videoDone = videoDone
        .then(() => videoSource.add(packet, meta))
        .catch((error) => (failure ??= error));
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
      if (read) levels = renderer.readLevels(analyser, image.width, style.slope).slice();
      for (; next < total && next / fps < until; next++) await renderFrame(next);
    } catch (error) {
      failure ??= error;
    }
  };

  // 0 秒の解析は、まだ音が無いので描き始める前に行う
  // 曲はフレームレートと同じ回数で解析し（プレビューと同じ）、各フレームはその時点までに読んだ最後の結果で描く
  const steps = Math.ceil(duration * fps);
  for (let k = 1; k < steps; k++) {
    offline.suspend(k / fps).then(
      async () => {
        await analyse((k + 1) / fps);
        offline.resume();
      },
      (error) => (failure ??= error)
    );
  }
  await analyse(steps > 1 ? 1 / fps : Infinity);
  await offline.startRendering();
  // 残ったフレームがあれば（丸めの誤差で）、最後の解析結果で描く
  await analyse(Infinity, false);
  if (!failure) await encoder.flush().catch((error) => (failure ??= error));
  if (encoder.state != 'closed') encoder.close();
  await videoDone;
  if (!failure) videoSource.close();
  await audioDone;
  if (!failure) await output.finalize().catch((error) => (failure ??= error));
  if (failure) {
    await output.cancel().catch(() => {});
    throw failure;
  }
  return toBlobUrl(output, settings.format);
};
