import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// コアは 0.10 のときと同じく unpkg から読む。toBlobURL で blob URL にしておくと、
// COEP の下でも別オリジンのスクリプトとして弾かれない
const CORE_VERSION = '0.12.10';

// マルチスレッド版（core-mt）は SharedArrayBuffer を使うため、service worker が付ける
// COOP / COEP ヘッダーが要る。service worker が効く前の初回訪問など、crossOriginIsolated で
// ないときはシングルスレッド版（core）を使う
const multiThread = () => self.crossOriginIsolated;

// core-mt は x264 のスレッド数を指定しないとコア数から多く作ろうとし、exec が終わらなくなる
// （8 以上で止まることを確認した）。4 に固定する
const MT_THREADS = '4';

// TODO: ログは dev環境のみで流す

// Node（プリレンダー時の SSR）では FFmpeg のコンストラクタが例外を投げるため、
// モジュールの読み込み時ではなく、ブラウザで呼ばれる load() の中で作る
let ffmpeg: FFmpeg;

export const load = async () => {
	ffmpeg = new FFmpeg();
	ffmpeg.on('log', ({ message }) => console.log(message));
	if (multiThread()) {
		const baseURL = `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/esm`;
		await ffmpeg.load({
			coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
			wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
			workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
		});
	} else {
		const baseURL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;
		await ffmpeg.load({
			coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
			wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
		});
	}
};

const VIDEO_KEY = 'video';

// return: blob url
export const convertMp4 = async (file: File, outputName = 'output.mp4') => {
	await ffmpeg.writeFile(VIDEO_KEY, await fetchFile(file));
	const threads = multiThread() ? ['-threads', MT_THREADS] : [];
	console.time('exec');
	await ffmpeg.exec(['-i', VIDEO_KEY, ...threads, outputName]);
	console.timeEnd('exec');
	const data = await ffmpeg.readFile(outputName);

	return URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
};
