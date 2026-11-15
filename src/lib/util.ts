export const clamp = (num: number, min: number, max: number) => {
  return Math.max(min, Math.min(num, max));
};

export const padding = (size: number, numString: number | string) => {
  return ('0'.repeat(size) + String(numString)).slice(-size);
};

// 再生時間の表示（分:秒）。秒は切り捨て、負や NaN は 0 にする
export const formatTime = (t: number) => {
  const sec = Number.isFinite(t) ? Math.max(0, Math.floor(t)) : 0;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

export const formatDate = (date: Date) => {
  const Y = date.getFullYear();
  const M = padding(2, date.getMonth() + 1);
  const D = padding(2, date.getDate());
  const h = padding(2, date.getHours());
  const m = padding(2, date.getMinutes());
  const s = padding(2, date.getSeconds());
  return Y + '_' + M + '_' + D + '_' + h + '_' + m + '_' + s;
};
