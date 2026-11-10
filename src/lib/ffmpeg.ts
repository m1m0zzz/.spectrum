import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { buildOutputArgs, mimeTypeOf, type EncodeSettings, type Trim } from './encode.ts';
// コアはビルドに同梱して同じオリジンから配る（?url でファイルとして出力される）。
// $ffmpeg-core / $ffmpeg-core-mt は vite.config.ts の別名で、各パッケージの dist/esm を指す。
// どちらも約 32MB あるため、service worker の事前キャッシュからは外している
import coreURL from '$ffmpeg-core/ffmpeg-core.js?url';
import wasmURL from '$ffmpeg-core/ffmpeg-core.wasm?url';
import mtCoreURL from '$ffmpeg-core-mt/ffmpeg-core.js?url';
import mtWasmURL from '$ffmpeg-core-mt/ffmpeg-core.wasm?url';
import mtWorkerURL from '$ffmpeg-core-mt/ffmpeg-core.worker.js?url';

// マルチスレッド版（core-mt）のスレッドは 32 本までで（PTHREAD_POOL_SIZE=32）、超えると exec が終わらなくなる。
// スレッド数を指定しないとデコーダーもエンコーダーもコア数から決まり、コアの多いマシンで上限を超えるため、
// 両方を固定する。デコーダーは増やしても速くならず、エンコーダーは 4 と 8 でほぼ差が無い
const MT_ARGS = { input: ['-threads', '1'], output: ['-threads', '4'] };

type Instance = { ffmpeg: FFmpeg; multiThread: boolean };

const create = async (multiThread: boolean): Promise<Instance> => {
	// Node（プリレンダー時の SSR）では FFmpeg のコンストラクタが例外を投げるため、ブラウザで呼ばれてから作る
	const ffmpeg = new FFmpeg();
	// TODO: ログは dev環境のみで流す
	ffmpeg.on('log', ({ message }) => console.log(message));
	try {
		await ffmpeg.load(
			multiThread
				? { coreURL: mtCoreURL, wasmURL: mtWasmURL, workerURL: mtWorkerURL }
				: { coreURL, wasmURL }
		);
	} catch (error) {
		// 読み込みに失敗した worker を残さない
		ffmpeg.terminate();
		throw error;
	}
	return { ffmpeg, multiThread };
};

// core-mt は SharedArrayBuffer を使うため、service worker が付ける COOP / COEP ヘッダーが要る。
// crossOriginIsolated でないとき（service worker が効く前の初回訪問など）と、core-mt が読み込めないとき
// （起動時に 1GB のメモリを確保するため、メモリの少ない端末で失敗しうる）はシングルスレッド版（core）を使う
const createWithFallback = async (): Promise<Instance> => {
	if (self.crossOriginIsolated) {
		try {
			return await create(true);
		} catch (error) {
			console.warn('ffmpeg: failed to load core-mt, falling back to core', error);
		}
	}
	return create(false);
};

let instance: Promise<Instance> | undefined;

// コアは使うときまで読み込まない。最初の呼び出しで読み込みを始め、以降は同じものを返す。
// 失敗したときは次の呼び出しでやり直す
export const load = () => {
	instance ??= createWithFallback().catch((error) => {
		instance = undefined;
		throw error;
	});
	return instance;
};

const VIDEO_KEY = 'video';

// 録画した WebM を設定に従って変換する。return: blob url
export const convertVideo = async (file: File, settings: EncodeSettings, trim?: Trim) => {
	const { ffmpeg, multiThread } = await load();
	const outputName = `output.${settings.format}`;
	await ffmpeg.writeFile(VIDEO_KEY, await fetchFile(file));
	const output = [...buildOutputArgs(settings, trim), outputName];
	const args = multiThread
		? [...MT_ARGS.input, '-i', VIDEO_KEY, ...MT_ARGS.output, ...output]
		: ['-i', VIDEO_KEY, ...output];
	try {
		console.time('exec');
		const code = await ffmpeg.exec(args);
		console.timeEnd('exec');
		if (code != 0) throw new Error(`ffmpeg exited with code ${code}`);
		// バイナリで読むので Uint8Array が返る。worker から転送された通常の ArrayBuffer で、SharedArrayBuffer ではない
		const data = (await ffmpeg.readFile(outputName)) as Uint8Array<ArrayBuffer>;
		return URL.createObjectURL(new Blob([data], { type: mimeTypeOf(settings.format) }));
	} finally {
		// 仮想ファイルシステムはメモリ上にあるため、書き出すたびに消さないと溜まっていく
		await ffmpeg.deleteFile(VIDEO_KEY).catch(() => {});
		await ffmpeg.deleteFile(outputName).catch(() => {});
	}
};
