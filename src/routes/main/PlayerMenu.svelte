<script lang="ts">
  import styles from './PlayerMenu.module.css';
  import { _ } from 'svelte-i18n';
  import { formatDate } from '#lib/util.ts';
  import { convertVideo, load, muxVideo } from '#lib/ffmpeg.ts';
  import { recordingVideoBitrate, type EncodeSettings } from '#lib/encode.ts';
  import { findEncoderConfig, renderVideo } from '#lib/offlineExport.ts';
  import { getAudioState } from '#lib/state/audio.svelte.ts';
  import { getExportState } from '#lib/state/export.svelte.ts';
  import { getImageState } from '#lib/state/image.svelte.ts';
  import { getSpectrumState } from '#lib/state/spectrum.svelte.ts';

  // 曲・再生・解析（<audio>・AudioContext・録画用の出力・FFT のサイズ）、画像、見た目の設定と canvas。
  // どれも作り始めたときに読む。書き出しの設定と範囲は「動画設定」タブとファイルタブで決め、進み具合はここで入れる
  const audioState = getAudioState();
  const image = getImageState();
  const spectrum = getSpectrumState();
  const exporter = getExportState();

  let anchorRef: HTMLAnchorElement | null = $state(null);
  let error = $state(false);
  let ffmpegStatus: 'idle' | 'loading' | 'error' | 'ok' = $state('idle');
  let convertError = $state(false);
  // 変換（ffmpeg）の進み具合（0〜1）
  let convertProgress = $state(0);
  // 映像を作る進み具合（0〜1）。高速書き出しのときだけ
  let renderProgress = $state(0);

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
        console.error(error);
      });
  };

  // 出来上がった動画をダウンロードのリンクに付ける
  const complete = (anchor: HTMLAnchorElement, url: string, filename: string) => {
    exporter.status = 'completed';
    if (anchor.href.startsWith('blob:')) URL.revokeObjectURL(anchor.href);
    anchor.download = filename;
    anchor.href = url;
  };

  const fail = (error: unknown) => {
    // コアの読み込みに失敗したときは、prepareFFmpeg がエラー表示を出している
    exporter.status = 'none';
    if (ffmpegStatus != 'error') convertError = true;
    console.error(error);
  };

  const makeVideo = async () => {
    if (exporter.busy) return;
    // リアルタイムの書き出しはシークを待ってから再生するため、そこでは操作の外になり、Safari は AudioContext を動かさない。
    // 押した処理の中で先に動かしておく（止まったままだと録画に音が入らない）
    audioState.resume();
    const { context: audioContext, recorderDestination, file } = audioState;
    const imageData = image.data;
    const playerRef = spectrum.canvas;
    if (!audioContext || !recorderDestination || !imageData || !playerRef || !anchorRef) {
      error = true;
      return;
    }
    if (exporter.rangeError) return;
    // 設定と範囲は作り始めた時点のものを使う（作成中に UI を触られても変わらない）
    const encode = { ...exporter.settings };
    const range = { start: exporter.rangeStart, end: exporter.rangeEnd };

    error = false;
    convertError = false;
    prepareFFmpeg();

    if (encode.method == 'fast' && file) {
      // エンコーダーを調べて待つあいだに、もう一度押されて 2 本走らないよう、先に作成中にする
      exporter.status = 'rendering';
      renderProgress = 0;
      const config = await findEncoderConfig(playerRef.width, playerRef.height, encode);
      if (config)
        return makeVideoFast(config, encode, range, audioContext, file, imageData, anchorRef);
      console.warn('fast export is not supported; falling back to realtime recording');
    }
    return recordVideo(encode, range, recorderDestination, anchorRef, playerRef);
  };

  // 曲を再生せずに描いてエンコードし（offlineExport.ts）、ffmpeg で曲とまとめる
  const makeVideoFast = async (
    config: VideoEncoderConfig,
    encode: EncodeSettings,
    range: { start: number; end: number },
    context: AudioContext,
    file: File,
    image: ImageData,
    anchor: HTMLAnchorElement
  ) => {
    const start = range.start;
    const duration = range.end - range.start;
    const filename = formatDate(new Date());
    audioState.pause();
    exporter.status = 'rendering';
    renderProgress = 0;
    try {
      const video = await renderVideo({
        config,
        settings: encode,
        audioFile: file,
        audioContext: context,
        fftSize: audioState.fftSize,
        image,
        style: spectrum.style,
        start,
        duration,
        onProgress: (ratio) => (renderProgress = ratio)
      });
      exporter.status = 'converting';
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
    range: { start: number; end: number },
    recorderDestination: MediaStreamAudioDestinationNode,
    anchor: HTMLAnchorElement,
    playerRef: HTMLCanvasElement
  ) => {
    const duration = range.end - range.start;
    const end = range.end;
    exporter.status = 'generating';

    audioState.pause();
    await audioState.seekAndWait(range.start);

    const canvasStream = playerRef.captureStream();
    const audioStream = recorderDestination.stream;
    const mediaStream = new MediaStream();
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

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      // canvas のトラックは書き出しのたびに作るので止める。音声のトラックは録画用の出力のもので、次の書き出しでも使うため止めない
      canvasStream.getTracks().forEach((track) => track.stop());
      const lead =
        recorderStartedAt && playingAt ? Math.max(0, (playingAt - recorderStartedAt) / 1000) : 0;
      const videoBlob = new Blob(chunks, { type: chunks[0]?.type ?? 'video/webm' });
      const filename = formatDate(new Date());
      const webmFile = new File([videoBlob], filename + '.webm', { type: videoBlob.type });
      exporter.status = 'converting';
      convertProgress = 0;
      convertVideo(webmFile, encode, { start: lead, duration }, (ratio) => {
        convertProgress = Math.max(convertProgress, ratio);
      })
        .then((url) => complete(anchor, url, `${filename}.${encode.format}`))
        .catch(fail);
    };

    mediaRecorder.start();
    try {
      // play() の Promise は、playing イベントと同じタイミング（音が鳴り始めたとき）に解決する
      await audioState.play();
      playingAt = performance.now();
    } catch (error) {
      console.error(error);
    }

    // 終了位置を過ぎたら止める。多少過ぎても変換時に -t で切り落とす。
    // 曲の最後まで再生したときは paused が true になるので、それでも止まる
    const watch = () => {
      if (audioState.currentTime >= end || audioState.paused) {
        audioState.pause();
        mediaRecorder.stop();
        return;
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  };
</script>

<section class={styles.root}>
  <button class="pixel-button" disabled={exporter.busy || exporter.rangeError} onclick={makeVideo}
    >{$_('generate_video')}</button
  >
  <p style:display={exporter.busy ? 'block' : 'none'}>
    {$_('generate_video_message')}
  </p>
  {#if exporter.status == 'rendering'}
    <p class={styles.progress}>
      {$_('render_progress', { values: { percent: Math.floor(renderProgress * 100) } })}
    </p>
  {/if}
  {#if exporter.status == 'converting'}
    <p class={styles.progress}>
      {$_('convert_progress', { values: { percent: Math.floor(convertProgress * 100) } })}
    </p>
  {/if}
  <p class="error" style:display={ffmpegStatus == 'error' ? 'block' : 'none'}>
    {$_('ffmpeg_error')}
  </p>
  <p class="error" style:display={convertError ? 'block' : 'none'}>{$_('convert_error')}</p>
  <p class="error" style:display={error ? 'block' : 'none'}>{$_('generate_video_error')}</p>
  <!-- svelte-ignore a11y_invalid_attribute -->
  <a
    href="#"
    download
    bind:this={anchorRef}
    style:display={exporter.status == 'completed' ? 'block' : 'none'}>{$_('download_video')}</a
  >
</section>
