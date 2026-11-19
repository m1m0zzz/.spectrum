import {
  applySlope,
  computeBandLevels,
  createBandMap,
  createSlopeOffsets,
  type BandMap
} from './canvas.ts';

// 画像をスペクトラムとして描く。画面のプレビュー（PlayerCanvas.svelte）と、
// 動画の高速書き出し（offlineExport.ts）の両方で使う
export type SpectrumStyle = {
  background: string;
  sensitivity: number;
  gridSize: number;
  // 点灯から消えるまでの時間（ms）
  smoothTime: number;
  // 高音側を持ち上げる傾き（dB/oct）。1 kHz を中心に傾ける
  slope: number;
};

// AnalyserNode の smoothingTimeConstant を、60 回/秒で読むときの値で表したもの。
// 0〜1 で、0 だと動きがもっとも速く、1 に近づくほど遅くなる
const ANALYSER_SMOOTHING = 0.85;

// 曲は動画のフレームレートと同じ回数（回/秒）で解析する（AnalyserNode を読む）。平滑化は読むたびにかかるため、
// 読む回数に合わせて係数を変え、フレームレートを変えても動きの速さが同じになるようにする
export const analyserSmoothing = (fps: number) => Math.pow(ANALYSER_SMOOTHING, 60 / fps);

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export class SpectrumRenderer {
  // 毎フレーム作り直さないよう、解析結果のバッファと対応表は使い回す
  private freqFloatData = new Float32Array(0);
  private freqByteData = new Uint8Array(0);
  private levels = new Float32Array(0);
  private bandMap: BandMap | null = null;
  private bandMapKey = '';
  private slopeOffsets = new Float32Array(0);
  private slopeKey = '';

  // 画像まわりのキャッシュ。image が差し替わったときに作り直す
  private preparedImage: ImageData | null = null;
  // 描画先。画像サイズの canvas に毎フレーム透明度だけ書き換えて、拡大して貼る
  private pixelCanvas: OffscreenCanvas | null = null;
  private pixelCtx: OffscreenCanvasRenderingContext2D | null = null;
  private pixelOut: ImageData | null = null;
  private pixelAlpha = new Float32Array(0); // 各ピクセルの現在の不透明度（0〜1）
  private sourceAlpha = new Float32Array(0); // 元画像の不透明度（0〜1）
  private columnThreshold = new Float32Array(0); // この行より下を点灯する
  // グリッド。セルの数は数千になり、毎フレーム描くと重いため、大きさや色が変わったときだけ描いて貼る
  private gridCanvas: OffscreenCanvas | null = null;
  private gridKey = '';

  constructor(private ctx: Context2D) {}

  // 1 フレーム描く。elapsed は前のフレームからの経過時間（ms）。
  // 画像か解析がまだないときは背景だけにする。点いている（消えかけを含む）点があれば true を返す
  draw(
    analyser: AnalyserNode | null,
    image: ImageData | null,
    style: SpectrumStyle,
    elapsed: number
  ) {
    const levels = analyser && image ? this.readLevels(analyser, image.width, style.slope) : null;
    return this.drawLevels(levels, image, style, elapsed);
  }

  // 解析結果を、画像の列ごとのレベル（0〜255）にして返す。返す配列は次に読むときに上書きする。
  // AnalyserNode の平滑化（smoothingTimeConstant）は読むたびにかかるため、読む頻度で動きの速さが変わる
  readLevels(analyser: AnalyserNode, columns: number, slope: number) {
    const binCount = analyser.frequencyBinCount;
    const map = this.getBandMap(binCount, columns);
    if (this.freqByteData.length != binCount) {
      this.freqByteData = new Uint8Array(binCount);
      this.freqFloatData = new Float32Array(binCount);
    }
    if (slope == 0) {
      analyser.getByteFrequencyData(this.freqByteData);
    } else {
      analyser.getFloatFrequencyData(this.freqFloatData);
      const offsets = this.getSlopeOffsets(binCount, analyser.context.sampleRate, slope);
      applySlope(
        this.freqFloatData,
        offsets,
        analyser.minDecibels,
        analyser.maxDecibels,
        this.freqByteData
      );
    }
    if (this.levels.length != map.begin.length) this.levels = new Float32Array(map.begin.length);
    return computeBandLevels(this.freqByteData, map, this.levels);
  }

  // 列ごとのレベル（readLevels の結果）で 1 フレーム描く。levels か image が無いときは背景だけにする。
  // 点いている（消えかけを含む）点があれば true を返す
  drawLevels(
    levels: Float32Array | null,
    image: ImageData | null,
    style: SpectrumStyle,
    elapsed: number
  ) {
    const { ctx } = this;
    const { width: w, height: h } = ctx.canvas;
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, w, h);
    if (!levels || !image) return false;
    if (image !== this.preparedImage) this.prepareImage(image);
    return this.drawPixelSpectrum(levels, image, style, w, h, elapsed);
  }

  private getBandMap(binCount: number, columns: number) {
    const key = `${binCount}:${columns}`;
    if (!this.bandMap || key != this.bandMapKey) {
      this.bandMap = createBandMap(binCount, columns);
      this.bandMapKey = key;
    }
    return this.bandMap;
  }

  private getSlopeOffsets(binCount: number, sampleRate: number, slope: number) {
    const key = `${binCount}:${sampleRate}:${slope}`;
    if (key != this.slopeKey) {
      this.slopeOffsets = createSlopeOffsets(binCount, sampleRate, slope);
      this.slopeKey = key;
    }
    return this.slopeOffsets;
  }

  private prepareImage(image: ImageData) {
    this.preparedImage = image;
    const { width, height } = image;
    this.pixelCanvas ??= new OffscreenCanvas(width, height);
    this.pixelCanvas.width = width;
    this.pixelCanvas.height = height;
    this.pixelCtx = this.pixelCanvas.getContext('2d')!;
    this.pixelOut = new ImageData(new Uint8ClampedArray(image.data), width, height);
    this.pixelAlpha = new Float32Array(width * height);
    this.sourceAlpha = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      this.sourceAlpha[i] = image.data[i * 4 + 3] / 255;
      this.pixelOut.data[i * 4 + 3] = 0;
    }
    this.columnThreshold = new Float32Array(width);
  }

  private drawPixelSpectrum(
    lv: Float32Array,
    image: ImageData,
    style: SpectrumStyle,
    w: number,
    h: number,
    elapsed: number
  ) {
    const { ctx, columnThreshold, pixelAlpha, sourceAlpha } = this;
    const W = image.width;
    const H = image.height;

    // 1 - y / H <= level のピクセルを点灯する。y >= H * (1 - level) と同じ
    for (let x = 0; x < W; x++) {
      columnThreshold[x] = H * (1 - (lv[x] / 256) * style.sensitivity);
    }
    // スムーズは「点灯から消えるまでの時間（ms）」。フレームレートに依らないよう経過時間で減らす
    const decrement = style.smoothTime <= 0 ? 1 : elapsed / style.smoothTime;
    const out = this.pixelOut!.data;
    let lit = false;
    for (let y = 0, i = 0; y < H; y++) {
      for (let x = 0; x < W; x++, i++) {
        const a = y >= columnThreshold[x] ? sourceAlpha[i] : Math.max(pixelAlpha[i] - decrement, 0);
        pixelAlpha[i] = a;
        out[i * 4 + 3] = a * 255;
        if (a > 0) lit = true;
      }
    }
    this.pixelCtx!.putImageData(this.pixelOut!, 0, 0);
    // 縮小するときは補間し、拡大するときはドットを保つ
    ctx.imageSmoothingEnabled = W > w || H > h;
    ctx.drawImage(this.pixelCanvas!, 0, 0, w, h);

    if (style.gridSize > 0) ctx.drawImage(this.getGrid(w, h, W, H, style), 0, 0);
    return lit;
  }

  // グリッドはセルの境目を背景色で塗って表す（セルを内側に gridSize / 2 ずつ縮めるのと同じ見た目）
  private getGrid(w: number, h: number, W: number, H: number, style: SpectrumStyle) {
    const key = `${w}x${h}:${W}x${H}:${style.gridSize}:${style.background}`;
    if (this.gridCanvas && key == this.gridKey) return this.gridCanvas;
    this.gridKey = key;
    this.gridCanvas ??= new OffscreenCanvas(w, h);
    // 大きさを設定し直すと中身も消える
    this.gridCanvas.width = w;
    this.gridCanvas.height = h;
    const ctx = this.gridCanvas.getContext('2d')!;
    const half = style.gridSize / 2;
    const cellWidth = w / W;
    const cellHeight = h / H;
    ctx.beginPath();
    for (let x = 0; x <= W; x++) ctx.rect(cellWidth * x - half, 0, half * 2, h);
    for (let y = 0; y <= H; y++) ctx.rect(0, cellHeight * y - half, w, half * 2);
    ctx.fillStyle = style.background;
    ctx.fill();
    return this.gridCanvas;
  }
}
