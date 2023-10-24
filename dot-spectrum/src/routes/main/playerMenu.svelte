<script lang="ts">
  import { onMount } from "svelte";
	import { _ } from "svelte-i18n";
	import { formatDate } from "$lib";

  export let audioRef: HTMLAudioElement | null;
  export let playerRef: HTMLCanvasElement | null;
  export let audioContext: AudioContext | null;
  export let recorderDestination: MediaStreamAudioDestinationNode;
  export let imageLoaded: boolean;

  let anchorRef: HTMLAnchorElement | null;
  let status: "none" | "generated" | "complete" = "none";
  let error = false;

  $: enableFullscreen = false;

  onMount(() => {
    enableFullscreen = document.fullscreenEnabled;
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

    // TODO; encoding mp4 w/ffmpeg.wasm

    mediaRecorder.ondataavailable = (e) => {
      const videoBlob = new Blob([e.data], { type: e.data.type });
      const blobUrl = window.URL.createObjectURL(videoBlob);
      anchorRef!.download = formatDate(new Date()) + ".webm"; // file name
      anchorRef!.href = blobUrl;
      status = "complete";
    }

    // play!
    error = false;
    status = "generated";

    audioRef.currentTime = 0;
    mediaRecorder.start();
    audioRef.play();
    audioRef.style.display = "none";

    audioRef.onended = () => {
      console.log("stop video");
      mediaRecorder.stop();
      audioRef!.style.display = "block";
    }
  }
</script>

<section>
  <button class="button" disabled={!enableFullscreen} on:click={() => playerRef?.requestFullscreen()}>
    {$_("change_full_screen")}
  </button>
  <p class="error" style:display={enableFullscreen ? "none" : "block"}>{$_("change_full_screen")}</p>

  <button class="button" on:click={() => makeVideo()}>{$_("generate_video")}</button>
  <br>
  <p style:display={status == "generated" ? "block" : "none"}>{$_("generate_video_message")}</p>
  <p class="error" style:display={error ? "block" : "none"}>{$_("generate_video_error")}</p>
  <!-- svelte-ignore a11y-invalid-attribute -->
  <a href="#" download bind:this={anchorRef}
    style:display={status == "complete" ? "block" : "none"}
  >{$_("download_video")}</a>
</section>
