<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { formatDate } from '#lib/util.ts';
  import { convertVideo, load, muxVideo } from '#lib/ffmpeg.ts';
  import { recordingVideoBitrate, type EncodeSettings } from '#lib/encode.ts';
  import { findEncoderConfig, renderVideo } from '#lib/offlineExport.ts';
  import type { SpectrumStyle } from '#lib/spectrumRenderer.ts';

  export let audioRef: HTMLAudioElement | null;
  export let playerRef: HTMLCanvasElement | null;
  export let audioContext: AudioContext | null;
  export let recorderDestination: MediaStreamAudioDestinationNode;
  export let imageLoaded: boolean;
  // 高速書き出しで、曲を解析しながら描くのに使う
  export let imageData: ImageData;
  export let audioFile: File | null;
  export let fftSize: number;
  export let style: SpectrumStyle;
  // 書き出しの設定と範囲（秒）は「動画設定」タブ（exportSettings.svelte）で決める
  export let settings: EncodeSettings;
  export let rangeStart: number;
  export let rangeEnd: number;
  // 曲を読み込んだうえで範囲が正しくないとき true
  export let rangeError: boolean;
  // 作成中（録画・変換）か。親に渡して、作成に関わる操作をできないようにする
  export let busy = false;

  let anchorRef: HTMLAnchorElement | null;
  // rendering は高速書き出しで映像を作っているところ、generating はリアルタイムで録画しているところ
  let status: 'none' | 'rendering' | 'generating' | 'converting' | 'completed' = 'none';
  let error = false;
  let ffmpegStatus: 'idle' | 'loading' | 'error' | 'ok' = 'idle';
  let convertError = false;
  // 変換（ffmpeg）の進み具合（0〜1）
  let convertProgress = 0;

  $: busy = status == 'rendering' || status == 'generating' || status == 'converting';
  // 映像を作る進み具合（0〜1）。高速書き出しのときだけ
  let renderProgress = 0;

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

  // シークが終わるのを待つ。Firefox では読み込みが止まっているとき（曲の最後まで送ったあとなど）に
  // seeked が来ないことがあるため、1 秒で先へ進む。再生を始めれば読み込まれ、位置はもう移っている
  const seek = (audio: HTMLAudioElement, time: number) =>
    new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        audio.removeEventListener('seeked', done);
        resolve();
      };
      const timer = setTimeout(done, 1000);
      audio.addEventListener('seeked', done);
      audio.currentTime = time;
    });

  // 出来上がった動画をダウンロードのリンクに付ける
  const complete = (anchor: HTMLAnchorElement, url: string, filename: string) => {
    status = 'completed';
    if (anchor.href.startsWith('blob:')) URL.revokeObjectURL(anchor.href);
    anchor.download = filename;
    anchor.href = url;
  };

  const fail = (error: unknown) => {
    // コアの読み込みに失敗したときは、prepareFFmpeg がエラー表示を出している
    status = 'none';
    if (ffmpegStatus != 'error') convertError = true;
    console.error(error);
  };

  const makeVideo = async () => {
    if (busy) return;
    if (!audioContext || !audioRef || !imageLoaded || !playerRef || !anchorRef) {
      error = true;
      return;
    }
    if (rangeError) return;
    // 設定は作り始めた時点のものを使う（作成中に UI を触られても変わらない）
    const encode = { ...settings };

    error = false;
    convertError = false;
    prepareFFmpeg();

    if (encode.method == 'fast' && audioFile) {
      const config = await findEncoderConfig(playerRef.width, playerRef.height, encode);
      if (config) return makeVideoFast(config, encode, audioContext, audioFile, anchorRef);
      console.warn('fast export is not supported; falling back to realtime recording');
    }
    return recordVideo(encode, audioRef, anchorRef, playerRef);
  };

  // 曲を再生せずに描いてエンコードし（offlineExport.ts）、ffmpeg で曲とまとめる
  const makeVideoFast = async (
    config: VideoEncoderConfig,
    encode: EncodeSettings,
    context: AudioContext,
    file: File,
    anchor: HTMLAnchorElement
  ) => {
    const start = rangeStart;
    const duration = rangeEnd - rangeStart;
    const filename = formatDate(new Date());
    audioRef?.pause();
    status = 'rendering';
    renderProgress = 0;
    try {
      console.time('render');
      const video = await renderVideo({
        config,
        settings: encode,
        audioFile: file,
        audioContext: context,
        fftSize,
        image: imageData,
        style: { ...style },
        start,
        duration,
        onProgress: (ratio) => (renderProgress = ratio)
      });
      console.timeEnd('render');
      status = 'converting';
      convertProgress = 0;
      const url = await muxVideo(video, file, encode, { start, duration }, (ratio) => {
        convertProgress = Math.max(convertProgress, ratio);
      });
      complete(anchor, url, `${filename}.${encode.format}`);
    } catch (error) {
      fail(error);
    }
  };

  // Media Recorder で、曲を再生しながら canvas を録画して動画を作る
  const recordVideo = async (
    encode: EncodeSettings,
    audio: HTMLAudioElement,
    anchor: HTMLAnchorElement,
    playerRef: HTMLCanvasElement
  ) => {
    const duration = rangeEnd - rangeStart;
    const end = rangeEnd;
    status = 'generating';

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
      convertProgress = 0;
      convertVideo(webmFile, encode, { start: lead, duration }, (ratio) => {
        convertProgress = Math.max(convertProgress, ratio);
      })
        .then((url) => complete(anchor, url, `${filename}.${encode.format}`))
        .catch(fail);
    };

    // play!
    mediaRecorder.start();
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
        return;
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  };
</script>

<section class="player-menu">
  <button class="pixel-button" disabled={busy || rangeError} on:click={makeVideo}
    >{$_('generate_video')}</button
  >
  <p style:display={busy ? 'block' : 'none'}>
    {$_('generate_video_message')}
  </p>
  {#if status == 'rendering'}
    <p class="convert-progress">
      {$_('render_progress', { values: { percent: Math.floor(renderProgress * 100) } })}
    </p>
  {/if}
  {#if status == 'converting'}
    <p class="convert-progress">
      {$_('convert_progress', { values: { percent: Math.floor(convertProgress * 100) } })}
    </p>
  {/if}
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
