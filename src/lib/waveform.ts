// 波形のプレビュー。曲を count 個の区間に分け、区間ごとの振幅（全チャンネルの絶対値）の最大を求める。
// デコードした音声は大きい（3 分のステレオで 60MB ほど）ため、ここで小さくして音声そのものは手放す。
// 範囲のハンドルを長押しすると 10 倍にズームするため、ズームしても帯の 1 ドットに 1 区間以上あるだけ細かくする
export const WAVEFORM_PEAKS = 8192;

export const computePeaks = (channels: Float32Array[], count = WAVEFORM_PEAKS) => {
  const peaks = new Float32Array(count);
  const length = channels[0]?.length ?? 0;
  if (length == 0) return peaks;
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i * length) / count);
    const to = Math.max(from + 1, Math.floor(((i + 1) * length) / count));
    let peak = 0;
    for (const data of channels) {
      for (let j = from; j < to && j < length; j++) {
        const v = Math.abs(data[j]);
        if (v > peak) peak = v;
      }
    }
    peaks[i] = peak;
  }
  return peaks;
};

// peaks のうち from〜to（曲全体を 0〜1 とした割合）を count 個にまとめ直す（各区間の最大をとる）。
// 区間より多くするときは、同じ値を繰り返す
export const resamplePeaks = (peaks: Float32Array, count: number, from = 0, to = 1) => {
  const out = new Float32Array(count);
  const length = peaks.length;
  if (length == 0) return out;
  const offset = from * length;
  const span = (to - from) * length;
  for (let i = 0; i < count; i++) {
    const lo = Math.min(length - 1, Math.max(0, Math.floor(offset + (i * span) / count)));
    const hi = Math.min(length, Math.max(lo + 1, Math.floor(offset + ((i + 1) * span) / count)));
    let peak = 0;
    for (let j = lo; j < hi; j++) if (peaks[j] > peak) peak = peaks[j];
    out[i] = peak;
  }
  return out;
};
