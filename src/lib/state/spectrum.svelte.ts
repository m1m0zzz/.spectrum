import { getContext, setContext } from 'svelte';
import type { SpectrumStyle } from '../spectrumRenderer.ts';

// スペクトラムの見た目の設定（「設定」タブ）と、それを描く canvas。
// FFT のサイズは解析のノードと一緒に AudioState が持つ
export class SpectrumState {
  // canvas（＝動画）の大きさ（px）
  width = $state(360);
  height = $state(360);
  background = $state('#000000');
  sensitivity = $state(1);
  gridSize = $state(0);
  // 点灯から消えるまでの時間（ms）
  smoothTime = $state(0);
  // 高音側を持ち上げる傾き（dB/oct）。曲の多くは高い音ほど弱く、0 だと低音側ばかりが高くなるため、最初から傾けておく
  slope = $state(4.5);

  // プレビューの canvas（PlayerCanvas）。リアルタイムの書き出しはこれを録画する
  canvas = $state.raw<HTMLCanvasElement | null>(null);

  get style(): SpectrumStyle {
    return {
      background: this.background,
      sensitivity: this.sensitivity,
      gridSize: this.gridSize,
      smoothTime: this.smoothTime,
      slope: this.slope
    };
  }
}

const KEY = Symbol('spectrum');
export const setSpectrumState = (state: SpectrumState) => setContext(KEY, state);
export const getSpectrumState = () => getContext<SpectrumState>(KEY);
