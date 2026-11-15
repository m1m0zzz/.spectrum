import { getContext, setContext } from 'svelte';
import { defaultEncodeSettings, type EncodeSettings } from '../encode.ts';
import type { AudioState } from './audio.svelte.ts';

// 書き出しの進み具合。rendering は高速書き出しで映像を作っているところ、
// generating はリアルタイムで録画しているところ、converting は ffmpeg で変換しているところ
export type ExportStatus = 'none' | 'rendering' | 'generating' | 'converting' | 'completed';

// 動画の書き出し。設定（「動画設定」タブ）・書き出す範囲（ファイルタブの音声の下）・進み具合
export class ExportState {
  settings: EncodeSettings = $state({ ...defaultEncodeSettings });
  // 書き出す範囲（秒）。曲が変わったら全体に戻す（resetRange）
  rangeStart = $state(0);
  rangeEnd = $state(0);
  // 範囲のハンドルをドラッグしているか。そのあいだ再生プレイヤーは、範囲の端で止めたり戻したりしない
  rangeEditing = $state(false);
  status: ExportStatus = $state('none');

  #audio: AudioState;
  constructor(audio: AudioState) {
    this.#audio = audio;
  }

  // 作成中（録画・変換）か。作成中は、作成に関わる操作（ファイル・設定・再生プレイヤー）をすべて止める
  get busy() {
    return this.status == 'rendering' || this.status == 'generating' || this.status == 'converting';
  }

  // 曲を読み込んだうえで範囲が正しくないとき true
  get rangeError() {
    const duration = this.#audio.duration;
    return (
      duration > 0 &&
      !(0 <= this.rangeStart && this.rangeStart < this.rangeEnd && this.rangeEnd <= duration)
    );
  }

  resetRange(duration: number) {
    this.rangeStart = 0;
    this.rangeEnd = Number.isFinite(duration) ? duration : 0;
  }
}

const KEY = Symbol('export');
export const setExportState = (state: ExportState) => setContext(KEY, state);
export const getExportState = () => getContext<ExportState>(KEY);
