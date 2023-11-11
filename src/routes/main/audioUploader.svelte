<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { toBase64 } from '$lib/image';

	const dispatch = createEventDispatcher();

	export let audioRef: HTMLAudioElement | null;
	export let audioContext: AudioContext | null;
	export let nodeAnalyser: AnalyserNode | null;
	export let fftSize: number;
	export let recorderDestination: MediaStreamAudioDestinationNode;

	let files: FileList;
	let audioLoaded = false;

	const uploadSound = async () => {
		if (!audioRef) return;
		const result = await toBase64(files[0]);

		audioRef.src = result;
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
	/>
	<audio controls={audioLoaded} src="" controlslist="nodownload" bind:this={audioRef} />
</section>
