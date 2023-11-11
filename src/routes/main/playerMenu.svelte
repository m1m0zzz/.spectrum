<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { formatDate } from '$lib';
	import { convertMp4, load } from '$lib/ffmpeg';

	export let audioRef: HTMLAudioElement | null;
	export let playerRef: HTMLCanvasElement | null;
	export let audioContext: AudioContext | null;
	export let recorderDestination: MediaStreamAudioDestinationNode;
	export let imageLoaded: boolean;

	let anchorRef: HTMLAnchorElement | null;
	let status: 'none' | 'generating' | 'converting' | 'completed' = 'none';
	let error = false;
	let ffmpegStatus: 'loading' | 'error' | 'ok' = 'loading';

	$: enableFullscreen = false;

	onMount(async () => {
		enableFullscreen = document.fullscreenEnabled;
		try {
			await load();
			ffmpegStatus = 'ok';
		} catch (error) {
			ffmpegStatus = 'error';
			console.log('error: ffmpeg load error');
			console.error(error);
		}
	});

	// Media Recorderを使用して動画を作成する
	const makeVideo = () => {
		if (!audioContext || !audioRef || !imageLoaded || !playerRef || !anchorRef) {
			error = true;
			return;
		}

		const canvasStream = playerRef.captureStream();
		const audioStream = recorderDestination.stream;
		const mediaStream = new MediaStream(); // canvasStream + audioStream
		[canvasStream, audioStream].forEach((stream) => {
			console.log(stream.getTracks());
			stream.getTracks().forEach((track) => mediaStream.addTrack(track));
		});
		const mediaRecorder = new MediaRecorder(mediaStream);

		mediaRecorder.ondataavailable = (e) => {
			const videoBlob = new Blob([e.data], { type: e.data.type });
			const filename = formatDate(new Date());
			const webmFile = new File([videoBlob], filename + '.webm', { type: videoBlob.type });
			status = 'converting';
			convertMp4(webmFile).then((url) => {
				status = 'completed';
				anchorRef!.download = filename + '.mp4';
				anchorRef!.href = url;
			});
		};

		// play!
		error = false;
		status = 'generating';

		audioRef.currentTime = 0;
		mediaRecorder.start();
		audioRef.play();
		audioRef.style.display = 'none';

		audioRef.onended = () => {
			console.log('stop video');
			mediaRecorder.stop();
			audioRef!.style.display = 'block';
		};
	};
</script>

<section>
	<button
		class="button"
		disabled={!enableFullscreen}
		on:click={() => playerRef?.requestFullscreen()}
	>
		{$_('change_full_screen')}
	</button>
	<p class="error" style:display={enableFullscreen ? 'none' : 'block'}>
		{$_('change_full_screen')}
	</p>

	<button class="button" on:click={() => makeVideo()}>{$_('generate_video')}</button>
	<br />
	<p style:display={status == 'generating' || status == 'converting' ? 'block' : 'none'}>
		{$_('generate_video_message')}
	</p>
	<p class="error" style:display={ffmpegStatus == 'error' ? 'block' : 'none'}>
		{$_('ffmpeg_error')}
	</p>
	<p class="error" style:display={error ? 'block' : 'none'}>{$_('generate_video_error')}</p>
	<!-- svelte-ignore a11y-invalid-attribute -->
	<a
		href="#"
		download
		bind:this={anchorRef}
		style:display={status == 'completed' ? 'block' : 'none'}>{$_('download_video')}</a
	>
</section>
