<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';

	const dispatch = createEventDispatcher();

	export let audioRef: HTMLAudioElement | null;
	export let audioContext: AudioContext | null;
	export let nodeAnalyser: AnalyserNode | null;
	export let fftSize: number;
	export let recorderDestination: MediaStreamAudioDestinationNode;

	let files: FileList;
	let audioLoaded = false;
	let objectUrl: string | null = null;

	const uploadSound = async () => {
		if (!audioRef) return;
		// data URL（base64）にすると長い曲でメモリと時間を食うため、object URL で読む
		if (objectUrl) URL.revokeObjectURL(objectUrl);
		objectUrl = URL.createObjectURL(files[0]);

		audioRef.src = objectUrl;
		audioLoaded = true;

		if (!audioContext) {
			// init audio context
			audioContext = new AudioContext();
			nodeAnalyser = audioContext.createAnalyser();
			nodeAnalyser.fftSize = fftSize;
			// 0～1の範囲でデータの動きの速さ 0だともっとも速く、1に近づくほど遅くなる
			nodeAnalyser.smoothingTimeConstant = 0.85;

			const nodeSource = audioContext.createMediaElementSource(audioRef);
			recorderDestination = audioContext.createMediaStreamDestination();

			nodeSource.connect(nodeAnalyser);
			nodeAnalyser.connect(recorderDestination);
			nodeAnalyser.connect(audioContext.destination);

			dispatch('message', {
				// audioRef: audioRef,
				audioContext: audioContext,
				nodeAnalyser: nodeAnalyser,
				fftSize: fftSize,
				recorderDestination: recorderDestination
			});
		}
	};

	onMount(() => {
		dispatch('mount', {
			audioRef: audioRef
		});
	});
</script>

<section>
	<h3>🎵 {$_('upload_audio')}</h3>
	<input
		type="file"
		accept="audio/*"
		aria-label="Upload audio"
		bind:files
		on:change={() => uploadSound()}
	/><br />
	<audio
		controls={audioLoaded}
		src=""
		controlslist="nodownload"
		bind:this={audioRef}
		on:loadedmetadata={() => dispatch('duration', { duration: audioRef?.duration ?? 0 })}
	></audio>
</section>
