<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { formatDate } from '#lib';
	import { convertVideo, load } from '#lib/ffmpeg.ts';
	import { recordingVideoBitrate, type EncodeSettings } from '#lib/encode.ts';

	export let audioRef: HTMLAudioElement | null;
	export let playerRef: HTMLCanvasElement | null;
	export let audioContext: AudioContext | null;
	export let recorderDestination: MediaStreamAudioDestinationNode;
	export let imageLoaded: boolean;
	// 書き出しの設定と範囲（秒）は「動画設定」タブ（exportSettings.svelte）で決める
	export let settings: EncodeSettings;
	export let rangeStart: number;
	export let rangeEnd: number;
	// 曲を読み込んだうえで範囲が正しくないとき true
	export let rangeError: boolean;
	// 書き出し中か。親に渡して、動画設定を変えられないようにする
	export let busy = false;

	let anchorRef: HTMLAnchorElement | null;
	let status: 'none' | 'generating' | 'converting' | 'completed' = 'none';
	let error = false;
	let ffmpegStatus: 'idle' | 'loading' | 'error' | 'ok' = 'idle';
	let convertError = false;

	$: busy = status == 'generating' || status == 'converting';

	// ffmpeg のコア（約 32MB）はページを開いたときではなく、動画を作り始めたときに読み込む。
	// 録画（曲の長さ）のあいだに読み込みが終わるので、変換を待つ時間はほとんど増えない
	const prepareFFmpeg = () => {
		if (ffmpegStatus == 'loading' || ffmpegStatus == 'ok') return;
		ffmpegStatus = 'loading';
		load()
			.then(() => {
				ffmpegStatus = 'ok';
			})
			.catch((error) => {
				ffmpegStatus = 'error';
				console.log('error: ffmpeg load error');
				console.error(error);
			});
	};

	const seek = (audio: HTMLAudioElement, time: number) =>
		new Promise<void>((resolve) => {
			audio.addEventListener('seeked', () => resolve(), { once: true });
			audio.currentTime = time;
		});

	// Media Recorderを使用して動画を作成する
	const makeVideo = async () => {
		if (busy) return;
		if (!audioContext || !audioRef || !imageLoaded || !playerRef || !anchorRef) {
			error = true;
			return;
		}
		if (rangeError) return;
		const audio = audioRef;
		const anchor = anchorRef;
		// 設定は録画の開始時点のものを使う（変換中に UI を触られても変わらない）
		const encode = { ...settings };
		const duration = rangeEnd - rangeStart;
		const end = rangeEnd;

		error = false;
		convertError = false;
		status = 'generating';
		prepareFFmpeg();

		audio.pause();
		await seek(audio, rangeStart);

		const canvasStream = playerRef.captureStream();
		const audioStream = recorderDestination.stream;
		const mediaStream = new MediaStream(); // canvasStream + audioStream
		[canvasStream, audioStream].forEach((stream) => {
			stream.getTracks().forEach((track) => mediaStream.addTrack(track));
		});
		const mediaRecorder = new MediaRecorder(mediaStream, {
			videoBitsPerSecond: recordingVideoBitrate(playerRef.width, playerRef.height, encode),
			// 変換で再エンコードするので、録画の段階では音質を落とさない
			audioBitsPerSecond: 320_000
		});

		// 録画の開始から音が鳴り始めるまでの遅れ。変換時にこの分を先頭から削る
		let recorderStartedAt = 0;
		let playingAt = 0;
		mediaRecorder.onstart = () => (recorderStartedAt = performance.now());
		audio.addEventListener('playing', () => (playingAt = performance.now()), { once: true });

		const chunks: Blob[] = [];
		mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
		mediaRecorder.onstop = () => {
			const lead =
				recorderStartedAt && playingAt ? Math.max(0, (playingAt - recorderStartedAt) / 1000) : 0;
			const videoBlob = new Blob(chunks, { type: chunks[0]?.type ?? 'video/webm' });
			const filename = formatDate(new Date());
			const webmFile = new File([videoBlob], filename + '.webm', { type: videoBlob.type });
			status = 'converting';
			convertVideo(webmFile, encode, { start: lead, duration })
				.then((url) => {
					status = 'completed';
					if (anchor.href.startsWith('blob:')) URL.revokeObjectURL(anchor.href);
					anchor.download = `${filename}.${encode.format}`;
					anchor.href = url;
				})
				.catch((error) => {
					// コアの読み込みに失敗したときは、prepareFFmpeg がエラー表示を出している
					status = 'none';
					if (ffmpegStatus != 'error') convertError = true;
					console.error(error);
				});
		};

		// play!
		mediaRecorder.start();
		audio.style.display = 'none';
		try {
			await audio.play();
		} catch (error) {
			console.error(error);
		}

		// 終了位置を過ぎたら止める。多少過ぎても変換時に -t で切り落とす
		const watch = () => {
			if (audio.currentTime >= end || audio.ended || audio.paused) {
				console.log('stop video');
				audio.pause();
				mediaRecorder.stop();
				audio.style.display = 'block';
				return;
			}
			requestAnimationFrame(watch);
		};
		requestAnimationFrame(watch);
	};
</script>

<section>
	<button class="button" disabled={busy || rangeError} on:click={makeVideo}
		>{$_('generate_video')}</button
	>
	<br />
	<p style:display={busy ? 'block' : 'none'}>
		{$_('generate_video_message')}
	</p>
	<p class="error" style:display={ffmpegStatus == 'error' ? 'block' : 'none'}>
		{$_('ffmpeg_error')}
	</p>
	<p class="error" style:display={convertError ? 'block' : 'none'}>{$_('convert_error')}</p>
	<p class="error" style:display={error ? 'block' : 'none'}>{$_('generate_video_error')}</p>
	<!-- svelte-ignore a11y-invalid-attribute -->
	<a
		href="#"
		download
		bind:this={anchorRef}
		style:display={status == 'completed' ? 'block' : 'none'}>{$_('download_video')}</a
	>
</section>
