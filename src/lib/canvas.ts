export const spectrumTypes = ['liner', 'log', 'pixel'] as const;
export type SpectrumType = (typeof spectrumTypes)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isSpectrumType = (arg: any): arg is SpectrumType => {
	return spectrumTypes.indexOf(arg) !== -1;
};

// 周波数ビン（AnalyserNode の frequencyBinCount 個）を表示の列に割り当てる対応表。
// 列 c はビン begin[c]〜end[c]（両端を含む）を受け持つ。どの列も 1 つ以上のビンを持ち、
// 列の数がビンの数より多いときは隣り合う列が同じビンを受け持つ（隙間や空の列ができない）
export type BandMap = { begin: Uint32Array; end: Uint32Array };
export type FrequencyScale = 'linear' | 'log';

// log 表示の下端（Hz）。これより低い帯域に列を割かない
export const MIN_LOG_FREQUENCY = 20;

// log 表示で下端にあたるビン。ビン 0 は直流なので 1 以上にする
export const minBinOf = (
	binCount: number,
	sampleRate: number,
	minFrequency = MIN_LOG_FREQUENCY
) => {
	const binWidth = sampleRate / (binCount * 2);
	return Math.min(Math.max(1, minFrequency / binWidth), binCount - 1);
};

// 描画のたびに計算すると重いため、ビンの数・列の数が変わったときだけ作る（NOTE.md）
export const createBandMap = (
	binCount: number,
	columns: number,
	scale: FrequencyScale,
	minBin = 1
): BandMap => {
	const begin = new Uint32Array(columns);
	const end = new Uint32Array(columns);
	const last = binCount - 1;
	const lo = scale == 'log' ? Math.min(Math.max(1, minBin), last) : 0;
	const ratio = binCount / lo;
	// 列 c の左端にあたるビンの位置（小数）
	const edge = (c: number) =>
		scale == 'log' ? lo * Math.pow(ratio, c / columns) : (binCount * c) / columns;

	let left = edge(0);
	for (let c = 0; c < columns; c++) {
		const right = edge(c + 1);
		const b = Math.min(Math.floor(left), last);
		begin[c] = b;
		end[c] = Math.min(Math.max(b, Math.floor(right) - 1), last);
		left = right;
	}
	end[columns - 1] = last;
	return { begin, end };
};

// pixel モード用の対応表。どの列にも別々のビンを 1 つ以上割り当て、ピクセル 1 列ごとに別の標本を持たせる。
// 対数（ビン 1〜ナイキスト）で割ると 1 列が 1 ビンに満たない低域は、1 列 1 ビンで進め、
// 対数の曲線に追いついたらそれに沿う（元の generateLogToPixelIndexMap と同じ割り当て）。
// 列の数が使えるビンの数（直流を除く binCount - 1）より多いときは、別々に割り当てられないため
// createBandMap と同じく隣り合う列でビンを共有する
export const createDistinctLogBandMap = (binCount: number, columns: number): BandMap => {
	// 直流（ビン 0）は使わない
	if (binCount - 1 < columns) return createBandMap(binCount, columns, 'log', 1);

	const begin = new Uint32Array(columns);
	const end = new Uint32Array(columns);
	const logN = Math.log(binCount);
	// ビン i が列 c より右にあるか。元の実装と同じ式で判定する
	const beyond = (i: number, c: number) => (Math.log(i) / logN) * columns > c;
	let left = 1;
	for (let c = 0; c < columns; c++) {
		let right = binCount;
		if (c < columns - 1) {
			// 対数の曲線で次の列が始まるビン
			let curve = Math.floor(Math.pow(binCount, (c + 1) / columns)) + 1;
			while (curve > 1 && beyond(curve - 1, c + 1)) curve--;
			while (!beyond(curve, c + 1)) curve++;
			// 最低 1 ビン進め、残りの列にも 1 ビンずつ残す
			right = Math.min(Math.max(left + 1, curve), binCount - (columns - c - 1));
		}
		begin[c] = left;
		end[c] = right - 1;
		left = right;
	}
	return { begin, end };
};

// 列ごとのレベル（0〜255）を out に書き込む。max は帯域の最大値、avg は平均値
export const computeBandLevels = (
	freq: Uint8Array,
	map: BandMap,
	out: Float32Array,
	reduce: 'max' | 'avg'
) => {
	const { begin, end } = map;
	for (let c = 0; c < begin.length; c++) {
		const b = begin[c];
		const e = end[c];
		if (reduce == 'max') {
			let m = 0;
			for (let i = b; i <= e; i++) if (freq[i] > m) m = freq[i];
			out[c] = m;
		} else {
			let sum = 0;
			for (let i = b; i <= e; i++) sum += freq[i];
			out[c] = sum / (e - b + 1);
		}
	}
	return out;
};
