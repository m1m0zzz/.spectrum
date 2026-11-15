import type { Pixels } from './image.ts';
import { clamp } from './util.ts';

// トリミングの範囲。元の画像の px（整数）で持つ
export type Rect = { x: number; y: number; width: number; height: number };

// つかんだところ。move は範囲の内側（全体を動かす）、ほかは辺（n・s・e・w）と角
export type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type Size = { width: number; height: number };

// 吸着させる縦横比。横長・縦長のどちら向きにも吸着させる
export const ASPECT_RATIOS = [
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 }
] as const;

export const fullRect = ({ width, height }: Size): Rect => ({ x: 0, y: 0, width, height });

export const isFullRect = (rect: Rect, { width, height }: Size) =>
  rect.x == 0 && rect.y == 0 && rect.width == width && rect.height == height;

export const sameRect = (a: Rect, b: Rect) =>
  a.x == b.x && a.y == b.y && a.width == b.width && a.height == b.height;

// 範囲 rect が縦横比にちょうど合っていれば、その比の名前。px は整数なので、比を掛けて丸めた長さが合えばよしとする。
// 小さい範囲では複数の比に合うことがあるため（1 × 1 は 1:1 にも 4:3 にも合う）、いちばん近い比を選ぶ
export const aspectLabel = ({ width, height }: Rect) => {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const { label, value } of ASPECT_RATIOS) {
    if (Math.round(height * value) != width && Math.round(width / value) != height) continue;
    const distance = Math.abs(Math.log(width / height / value));
    if (distance < bestDistance) {
      best = label;
      bestDistance = distance;
    }
  }
  return best;
};

type DragOptions = {
  // 範囲の最小の幅・高さ（px）。画像より大きいときは画像の大きさにする
  minSize?: number;
  // 縦横比に合わせるのに、動かしている辺をこれだけ（px）までずらしてよい。0 なら吸着させない
  snap?: number;
};

// start の範囲を handle のところでつかみ、(dx, dy) px 動かしたときの範囲。画像（bounds）からははみ出させない。
// 辺や角を動かしたときは、動かしている辺だけをずらして ASPECT_RATIOS の比に吸着させる（反対側の辺は動かさない）
export const dragRect = (
  start: Rect,
  handle: Handle,
  dx: number,
  dy: number,
  bounds: Size,
  { minSize = 1, snap = 0 }: DragOptions = {}
): Rect => {
  if (handle == 'move') {
    return {
      ...start,
      x: clamp(Math.round(start.x + dx), 0, bounds.width - start.width),
      y: clamp(Math.round(start.y + dy), 0, bounds.height - start.height)
    };
  }

  const min = clamp(Math.round(minSize), 1, Math.min(bounds.width, bounds.height));
  const west = handle.includes('w');
  const east = handle.includes('e');
  const north = handle.includes('n');
  const south = handle.includes('s');

  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (west) left = clamp(Math.round(left + dx), 0, right - min);
  if (east) right = clamp(Math.round(right + dx), left + min, bounds.width);
  if (north) top = clamp(Math.round(top + dy), 0, bottom - min);
  if (south) bottom = clamp(Math.round(bottom + dy), top + min, bounds.height);

  if (snap > 0) {
    // 比に合わせた長さの候補（ずらす量と、ずらした後の 4 辺）のうち、ずらす量がいちばん小さいもの
    const candidates: [number, [number, number, number, number]][] = [];
    for (const { value } of ASPECT_RATIOS) {
      if (west || east) {
        const width = Math.round((bottom - top) * value);
        const l = west ? right - width : left;
        if (width >= min && l >= 0 && l + width <= bounds.width) {
          candidates.push([Math.abs(width - (right - left)), [l, top, l + width, bottom]]);
        }
      }
      if (north || south) {
        const height = Math.round((right - left) / value);
        const t = north ? bottom - height : top;
        if (height >= min && t >= 0 && t + height <= bounds.height) {
          candidates.push([Math.abs(height - (bottom - top)), [left, t, right, t + height]]);
        }
      }
    }
    const best = candidates
      .filter(([shift]) => shift <= snap)
      .reduce<(typeof candidates)[number] | null>((a, c) => (a && a[0] <= c[0] ? a : c), null);
    if (best) [left, top, right, bottom] = best[1];
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
};

export const cropPixels = (src: Pixels, rect: Rect): Pixels<ArrayBuffer> => {
  const { x, y, width, height } = rect;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row++) {
    const from = ((y + row) * src.width + x) * 4;
    data.set(src.data.subarray(from, from + width * 4), row * width * 4);
  }
  return { width, height, data };
};
