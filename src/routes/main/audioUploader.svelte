<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { computePeaks } from '#lib/waveform.ts';
  import { ANALYSER_SMOOTHING } from '#lib/spectrumRenderer.ts';
  import FileInput from './fileInput.svelte';

  const dispatch = createEventDispatcher();

  // 再生プレイヤー（<audio>）はタブの外に置くため、親が持つ要素を受け取る
  export let audioRef: HTMLAudioElement | null;
  export let audioContext: AudioContext | null;
  export let nodeAnalyser: AnalyserNode | null;
  export let fftSize: number;
  export let recorderDestination: MediaStreamAudioDestinationNode;
  // 動画の作成中は曲を差し替えられないようにする
  export let disabled = false;
  // 波形のプレビュー（computePeaks の結果）。デコードできなかったときは null
  export let waveform: Float32Array | null = null;
  // 読み込んだ曲のファイル。高速書き出しで、曲をデコードし直すのに使う
  export let audioFile: File | null = null;

  let files: FileList | undefined;
  let objectUrl: string | null = null;

  // 波形を求める。デコード中に別の曲を読み込んだら、古い方の結果は捨てる
  let decoding = 0;
  const loadWaveform = async (file: File, context: AudioContext) => {
    const id = ++decoding;
    waveform = null;
    try {
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
        buffer.getChannelData(i)
      );
      if (id == decoding) waveform = computePeaks(channels);
    } catch (error) {
      // 波形はなくても再生と書き出しはできるため、出さないだけにする
      console.error(error);
    }
  };

  const uploadSound = async () => {
    // ダイアログを取り消すと選択が空になる。そのときは今の曲のままにする
    if (!audioRef || !files?.[0]) return;
    // data URL（base64）にすると長い曲でメモリと時間を食うため、object URL で読む
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(files[0]);

    audioRef.src = objectUrl;
    audioFile = files[0];

    if (!audioContext) {
      // init audio context
      audioContext = new AudioContext();
      nodeAnalyser = audioContext.createAnalyser();
      nodeAnalyser.fftSize = fftSize;
      nodeAnalyser.smoothingTimeConstant = ANALYSER_SMOOTHING;

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

    loadWaveform(files[0], audioContext);
  };
</script>

<section>
  <h3>🎵 {$_('upload_audio')}</h3>
  <FileInput
    id="audio-file"
    accept="audio/*"
    ariaLabel="Upload audio"
    {disabled}
    bind:files
    on:change={() => uploadSound()}
  />
</section>
