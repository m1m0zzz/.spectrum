<script lang="ts">
  import styles from './ImageUploader.module.css';
  import { _ } from 'svelte-i18n';
  import {
    loadImage,
    MAX_IMAGE_PIXELS,
    maxPercentWithin,
    resample,
    scaledSize,
    type Pixels
  } from '#lib/image.ts';
  import {
    ASPECT_RATIOS,
    aspectLabel,
    cropPixels,
    fullRect,
    isFullRect,
    type Rect
  } from '#lib/crop.ts';
  import FileInput from '#lib/components/FileInput.svelte';
  import CropBox from '#lib/components/CropBox.svelte';
  import { getExportState } from '#lib/state/export.svelte.ts';
  import { getImageState } from '#lib/state/image.svelte.ts';

  // トリミング・ドット化した画像は ImageState に入れる
  const image = getImageState();
  const exporter = getExportState();
  const disabled = $derived(exporter.busy);

  let previewRef: HTMLCanvasElement | null = $state(null);
  // プレビューの表示の縦横比。ドット化した大きさは幅と高さをそれぞれ切り捨てるため、縦横比がわずかにずれ、
  // 幅いっぱいに見せると縮小率を動かすたびに高さが変わる。そこで、縮小する前の大きさの比で見せる
  let previewAspect = $state('');
  let img: HTMLImageElement | null = $state.raw(null);

  // 読み込んだ画像の画素。ドット化の割合を動かすたびに読み直さないよう、読み込んだときに 1 回だけ取る
  let source: ImageData | null = $state.raw(null);

  // ドット化したときの大きさ（元の画像に対する %、1〜100）
  let pixelationPercent = $state(50);
  let isDoPixelation = $state(false);

  // トリミングの範囲（元の画像の px）と、プレビューで範囲を調整しているところか。
  // トリミングしてからドット化する（縮小率はトリミングした画像に対する割合）
  let crop: Rect = $state(fullRect({ width: 0, height: 0 }));
  let cropping = $state(false);

  let imgError = $state(false);
  const pixelatedSize = $derived(scaledSize(crop.width, crop.height, pixelationPercent));
  const cropped = $derived(source != null && !isFullRect(crop, source));
  const cropAspect = $derived(aspectLabel(crop));

  const toImageData = ({ width, height, data }: Pixels<ArrayBuffer>) =>
    new ImageData(data, width, height);
  const pixelate = (pixels: ImageData) =>
    isDoPixelation ? toImageData(resample(pixels, pixelationPercent)) : pixels;

  // トリミングとドット化をして、スペクトラムに使う画像にする
  const applyImage = () => {
    if (!source) return;
    image.data = pixelate(
      isFullRect(crop, source) ? source : toImageData(cropPixels(source, crop))
    );
  };

  // プレビュー。トリミングの範囲を調整している間は、範囲を選べるように画像全体（ドット化したもの）を見せる
  const drawPreview = () => {
    if (!previewRef || !source || !image.data) return;
    const shown = cropping ? pixelate(source) : image.data;
    previewRef.width = shown.width;
    previewRef.height = shown.height;
    const area = cropping ? source : crop;
    previewAspect = `${area.width} / ${area.height}`;
    previewRef.getContext('2d')?.putImageData(shown, 0, 0);
  };

  const pixelationImage = () => {
    applyImage();
    drawPreview();
  };

  const toggleCropping = () => {
    cropping = !cropping;
    drawPreview();
  };

  let objectUrl: string | null = null;
  // 読み込みの番号。続けて選んだとき、後から終わった古い方の結果（成功も失敗も）は捨てる
  let loading = 0;
  // 画像として読めないファイルを選んだとき true。そのときは今の画像のままにする
  let loadError = $state(false);

  const uploadImage = async (files: FileList | undefined) => {
    // data URL（base64）にすると大きい画像でメモリと時間を食うため、object URL で読む
    // ダイアログを取り消すと選択が空になる。そのときは今の画像のままにする
    if (!files?.[0]) return;
    const id = ++loading;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(files[0]);
    let loaded: HTMLImageElement;
    try {
      loaded = await loadImage(objectUrl);
    } catch (error) {
      if (id != loading) return;
      loadError = true;
      console.error(error);
      // ファイル欄の名前を、使っている画像のファイルに戻させる
      return false;
    }
    if (id != loading) return;
    loadError = false;
    img = loaded;

    // 画素を取るための作業用の canvas
    const work = document.createElement('canvas');
    work.width = img.width;
    work.height = img.height;
    const ctx = work.getContext('2d') as CanvasRenderingContext2D;
    ctx.drawImage(img, 0, 0);
    source = ctx.getImageData(0, 0, img.width, img.height);
    crop = fullRect(source);
    cropping = false;

    if (img.width * img.height > MAX_IMAGE_PIXELS) {
      imgError = true;
      isDoPixelation = true;
      pixelationPercent = maxPercentWithin(img.width, img.height);
    } else {
      imgError = false;
      isDoPixelation = false;
    }

    pixelationImage();
  };
</script>

<section>
  <h3>🖼️ {$_('upload_image')}</h3>
  <FileInput
    id="image-file"
    accept="image/*"
    ariaLabel="Upload image"
    {disabled}
    onchange={uploadImage}
  />
  {#if loadError}
    <p class="error">{$_('upload_image_load_error')}</p>
  {/if}
  {#if imgError}
    <p class="error">
      {$_('upload_image_error')}
    </p>
  {/if}
  {#if image.loaded}
    <p>
      {$_('image_info', { values: { width: img?.width || 0, height: img?.height || 0 } })}
    </p>
    <div class={styles.pixelation}>
      <p>
        <span>{$_('is_pixelation')}</span>
        <button
          class={['no-button', isDoPixelation ? styles.pixelationActive : 'action-link']}
          {disabled}
          onclick={() => {
            isDoPixelation = true;
            pixelationImage();
          }}>{isDoPixelation ? '>' : ''}{$_('do_pixelation')}</button
        >
        <span>/</span>
        <button
          class={['no-button', isDoPixelation ? 'action-link' : styles.pixelationActive]}
          {disabled}
          onclick={() => {
            isDoPixelation = false;
            pixelationImage();
          }}>{isDoPixelation ? '' : '>'}{$_('do_not_pixelation')}</button
        >
      </p>
      {#if isDoPixelation}
        <!-- 上の段に縮小率（スライダーと %）、下の段に右寄せで出来上がりの大きさ -->
        <div class={styles.pixelationSize}>
          <div class={styles.pixelationRow}>
            <label for="pixelation-percent">{$_('pixelation_size')}</label>
            <input
              id="pixelation-percent"
              type="range"
              class={['pixel-range', styles.pixelationSlider]}
              min="1"
              max="100"
              step="1"
              {disabled}
              value={pixelationPercent}
              oninput={(e) => {
                pixelationPercent = Number(e.currentTarget.value);
                pixelationImage();
              }}
              style:--progress="{((pixelationPercent - 1) / 99) * 100}%"
            />
            <span class={styles.pixelationPercent}
              ><span>{pixelationPercent}%</span><span aria-hidden="true">100%</span></span
            >
          </div>
          <p class={styles.pixelationResult}>
            {pixelatedSize.width} px × {pixelatedSize.height} px
          </p>
        </div>
      {/if}
    </div>
  {/if}

  <div class={styles.previewContainer} style:display={image.loaded ? 'block' : 'none'}>
    <!-- トリミング。押すと、プレビューに枠を出して範囲を調整できる。調整している間は大きさと縦横比を出す -->
    <div class={styles.cropToolbar}>
      <button class="pixel-button" aria-pressed={cropping} {disabled} onclick={toggleCropping}
        >{cropping ? $_('crop_done') : $_('crop')}</button
      >
      {#if cropping}
        <button
          class="no-button action-link"
          disabled={disabled || !cropped}
          onclick={() => {
            if (!source) return;
            crop = fullRect(source);
            applyImage();
          }}>{$_('crop_reset')}</button
        >
        <p class={styles.cropSize}>
          <!-- 縦横比は合うときだけ出る。出たときに列が折り返して高さが変わらないよう、いちばん長い比の幅を常にとる -->
          <span class={styles.cropAspect}>
            <span>{cropAspect ?? ''}</span>
            {#each ASPECT_RATIOS as { label } (label)}<span aria-hidden="true">{label}</span>{/each}
          </span>
          <span>{crop.width} px × {crop.height} px</span>
        </p>
      {/if}
    </div>
    <div class={styles.crop}>
      <canvas
        id="preview"
        class={styles.preview}
        bind:this={previewRef}
        width="0"
        height="0"
        style:aspect-ratio={previewAspect || null}
      ></canvas>
      {#if cropping && source}
        <!-- マウスストーカー（Mouse.svelte）が、トリミングの枠の上で大きくなるようにする -->
        <CropBox
          data-stalker-target
          width={source.width}
          height={source.height}
          {disabled}
          bind:rect={crop}
          onchange={() => applyImage()}
        />
      {/if}
    </div>
  </div>
</section>
