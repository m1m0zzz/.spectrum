import { getContext, setContext } from 'svelte';

// スペクトラムに使う画像（トリミング・ドット化の後）。画像の読み込み（ImageUploader）が入れ、
// プレビュー・大きさの選択・書き出しが読む
export class ImageState {
  // 読み込む前は null
  data = $state.raw<ImageData | null>(null);

  get loaded() {
    return this.data != null;
  }
}

const KEY = Symbol('image');
export const setImageState = (state: ImageState) => setContext(KEY, state);
export const getImageState = () => getContext<ImageState>(KEY);
