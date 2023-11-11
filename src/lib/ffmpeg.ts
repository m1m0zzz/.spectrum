import { createFFmpeg, fetchFile, type FFmpeg } from '@ffmpeg/ffmpeg';

// const baseURL = "https://unpkg.com/@ffmpeg/core-mt@0.12.4/dist/esm"

// TODO: ログは dev環境のみで流す

const ffmpeg: FFmpeg = createFFmpeg({
	log: true
});

export const load = async () => {
	await ffmpeg.load();
};

const VIDEO_KEY = 'video';

// return: blob url
export const convertMp4 = async (file: File, outputName = 'output.mp4') => {
	ffmpeg.FS('writeFile', VIDEO_KEY, await fetchFile(file));
	console.time('exec');
	await ffmpeg.run('-i', VIDEO_KEY, outputName);
	console.timeEnd('exec');
	const data = ffmpeg.FS('readFile', outputName);

	return URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
};
