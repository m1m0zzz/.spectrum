import { getContext, setContext } from 'svelte';
import { ANALYSER_SMOOTHING } from '../spectrumRenderer.ts';
import { computePeaks } from '../waveform.ts';

// 曲と、その再生・解析の状態。<audio> 要素と Web Audio のノードはここで作って持つ（要素は DOM に置かない）。
// 画面の部品（再生プレイヤー・範囲のバー・プレビュー・書き出し）は、要素を直接触らずにこれを通して読み書きする。
// 要素とノードはブラウザで曲を読み込んだときに作る（サーバーでの描画では作らない）
export class AudioState {
  // 要素とノード。中身が入れ替わるだけで、画面は値（duration など）の方を見る
  element: HTMLAudioElement | null = null;
  context: AudioContext | null = null;
  // 録画（MediaRecorder）に音を渡す出力
  recorderDestination: MediaStreamAudioDestinationNode | null = null;
  // プレビューが毎フレーム読む。曲を読み込んだときに作られるため、画面が気付けるよう状態にする
  analyser = $state.raw<AnalyserNode | null>(null);

  // 読み込んだ曲のファイル。高速書き出しで、曲をデコードし直すのに使う
  file = $state.raw<File | null>(null);
  // 波形のプレビュー（computePeaks の結果）。デコードできなかったときは null
  waveform = $state.raw<Float32Array | null>(null);

  // 再生の状態。要素のイベントで読み、再生中は毎フレーム読む
  duration = $state(0); // 秒。読み込む前は 0
  currentTime = $state(0);
  paused = $state(true);
  seeking = $state(false);
  volume = $state(1);
  muted = $state(false);

  // FFT のサイズ。解析のノードがあればすぐに反映する
  #fftSize = $state(8192);
  get fftSize() {
    return this.#fftSize;
  }
  set fftSize(size: number) {
    this.#fftSize = size;
    if (this.analyser) this.analyser.fftSize = size;
  }

  get ready() {
    return this.duration > 0;
  }

  #objectUrl: string | null = null;
  #frame = 0;
  #decoding = 0;

  // 曲を読み込む。ファイルを選んだ操作の中で呼ぶ（AudioContext はユーザーの操作の中で作らないと音が出ない）
  load(file: File) {
    const element = this.#ensureElement();
    // data URL（base64）にすると長い曲でメモリと時間を食うため、object URL で読む
    if (this.#objectUrl) URL.revokeObjectURL(this.#objectUrl);
    this.#objectUrl = URL.createObjectURL(file);
    element.src = this.#objectUrl;
    this.file = file;

    const context = this.#ensureGraph(element);
    this.#loadWaveform(file, context);
  }

  play() {
    return this.element?.play() ?? Promise.resolve();
  }

  pause() {
    this.element?.pause();
  }

  // 再生位置を移す。曲の長さちょうどへシークすると、Firefox は読み込みが止まり、
  // その後の再生（書き出しも）が進まなくなる。最後まで送っても、ほんの少し手前で止める
  seek(time: number) {
    const element = this.element;
    if (!element) return;
    element.currentTime = Math.min(Math.max(0, time), Math.max(0, this.duration - 0.05));
    this.currentTime = element.currentTime;
    this.seeking = element.seeking;
  }

  setVolume(volume: number) {
    if (!this.element) return;
    this.element.volume = volume;
    this.element.muted = false;
  }

  setMuted(muted: boolean) {
    if (this.element) this.element.muted = muted;
  }

  // サーバーでの描画（ビルド時の HTML の生成）でも呼ばれ、そこには cancelAnimationFrame が無い
  destroy() {
    if (this.#frame) cancelAnimationFrame(this.#frame);
    if (this.#objectUrl) URL.revokeObjectURL(this.#objectUrl);
    this.#objectUrl = null;
  }

  #ensureElement() {
    if (this.element) return this.element;
    const element = new Audio();
    const read = () => this.#read();
    for (const type of [
      'loadedmetadata',
      'durationchange',
      'emptied',
      'timeupdate',
      'seeking',
      'seeked',
      'volumechange',
      'pause',
      'ended'
    ]) {
      element.addEventListener(type, read);
    }
    element.addEventListener('play', () => {
      read();
      cancelAnimationFrame(this.#frame);
      this.#frame = requestAnimationFrame(this.#follow);
    });
    this.element = element;
    return element;
  }

  // 曲 → 解析 → スピーカー・録画、とつなぐ。一度だけ作り、曲を替えても使い回す
  #ensureGraph(element: HTMLAudioElement) {
    if (this.context) return this.context;
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = this.#fftSize;
    analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;
    const source = context.createMediaElementSource(element);
    const recorderDestination = context.createMediaStreamDestination();
    source.connect(analyser);
    analyser.connect(recorderDestination);
    analyser.connect(context.destination);
    this.context = context;
    this.recorderDestination = recorderDestination;
    this.analyser = analyser;
    return context;
  }

  // 波形を求める。デコード中に別の曲を読み込んだら、古い方の結果は捨てる
  async #loadWaveform(file: File, context: AudioContext) {
    const id = ++this.#decoding;
    this.waveform = null;
    try {
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
        buffer.getChannelData(i)
      );
      if (id == this.#decoding) this.waveform = computePeaks(channels);
    } catch (error) {
      // 波形はなくても再生と書き出しはできるため、出さないだけにする
      console.error(error);
    }
  }

  #read() {
    const element = this.element;
    if (!element) return;
    this.duration = Number.isFinite(element.duration) ? element.duration : 0;
    this.currentTime = element.currentTime;
    this.paused = element.paused;
    this.seeking = element.seeking;
    this.volume = element.volume;
    this.muted = element.muted;
  }

  // 再生中は timeupdate（4 回/秒ほど）だけでは表示がかくつくため、毎フレーム読む
  #follow = () => {
    const element = this.element;
    if (!element) return;
    this.currentTime = element.currentTime;
    this.seeking = element.seeking;
    this.paused = element.paused;
    if (!element.paused) this.#frame = requestAnimationFrame(this.#follow);
  };
}

const KEY = Symbol('audio');
export const setAudioState = (state: AudioState) => setContext(KEY, state);
export const getAudioState = () => getContext<AudioState>(KEY);
