// 波形のプレビュー。曲を count 個の区間に分け、区間ごとの振幅（全チャンネルの絶対値）の最大を求める。
// デコードした音声は大きい（3 分のステレオで 60MB ほど）ため、ここで小さくして音声そのものは手放す
export const WAVEFORM_PEAKS = 2048;

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

// peaks を count 個にまとめ直す（各区間の最大をとる）。区間より多くするときは、同じ値を繰り返す
export const resamplePeaks = (peaks: Float32Array, count: number) => {
	const out = new Float32Array(count);
	const length = peaks.length;
	if (length == 0) return out;
	for (let i = 0; i < count; i++) {
		const from = Math.floor((i * length) / count);
		const to = Math.max(from + 1, Math.floor(((i + 1) * length) / count));
		let peak = 0;
		for (let j = from; j < to; j++) if (peaks[j] > peak) peak = peaks[j];
		out[i] = peak;
	}
	return out;
};
