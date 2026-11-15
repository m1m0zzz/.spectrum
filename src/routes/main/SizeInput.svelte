<script lang="ts">
  import { clamp } from '#lib/util.ts';
  import PixelNumber from '#lib/components/PixelNumber.svelte';
  import { _ } from 'svelte-i18n';
  import PixelSelect from '#lib/components/PixelSelect.svelte';
  import { getExportState } from '#lib/state/export.svelte.ts';
  import { getImageState } from '#lib/state/image.svelte.ts';
  import { getSpectrumState } from '#lib/state/spectrum.svelte.ts';

  // キャンバス（＝動画）の大きさ。スペクトラムに使う画像（トリミング・ドット化の後）の縦横比に合わせる
  const spectrum = getSpectrumState();
  const image = getImageState();
  const exporter = getExportState();
  const imageWidth = $derived(image.data?.width ?? 0);
  const imageHeight = $derived(image.data?.height ?? 0);
  const disabled = $derived(exporter.busy);

  // https://developer.mozilla.org/ja/docs/Web/HTML/Element/canvas#キャンバスの最大寸法
  const MAX_SIZE = 16384;

  // プリセットは高さで選び、幅は画像の縦横比に合わせる（画像を読み込む前は 1:1）
  const HEIGHTS = [240, 360, 480, 720, 1080];
  const widthFor = (height: number, width: number, imgHeight: number) =>
    clamp(
      Math.round(width > 0 && imgHeight > 0 ? (height * width) / imgHeight : height),
      1,
      MAX_SIZE
    );

  // 選択欄の値。プリセットは高さ、カスタムは 'custom'。既定は 360h
  let sizeValue = $state('360');
  const customInput = $derived(sizeValue == 'custom');
  const sizeOptions = $derived([
    ...HEIGHTS.map((height) => ({
      value: String(height),
      label: `${height}h (${widthFor(height, imageWidth, imageHeight)}×${height})`
    })),
    { value: 'custom', label: $_('parameters_custom') }
  ]);

  // 大きさを選んだときと、画像（の大きさ）が変わったときに、キャンバスの大きさを決め直す。
  // カスタムは、画像の大きさを既定にする（その後に手で変えた値は、次に画像が変わるまで保つ）
  const applySize = (value: string, width: number, height: number) => {
    if (value == 'custom') {
      if (width > 0 && height > 0) {
        spectrum.width = clamp(width, 1, MAX_SIZE);
        spectrum.height = clamp(height, 1, MAX_SIZE);
      }
    } else {
      // spectrum.height を読み返すと、この effect がそれにも反応してしまうため、値は手元で持つ
      const presetHeight = Number(value);
      spectrum.height = presetHeight;
      spectrum.width = widthFor(presetHeight, width, height);
    }
  };
  $effect.pre(() => applySize(sizeValue, imageWidth, imageHeight));
</script>

<div>
  <span id="size-label">{$_('parameters_window_size')}</span>
  <PixelSelect
    id="size"
    labelledby="size-label"
    options={sizeOptions}
    bind:value={sizeValue}
    {disabled}
  />
  {#if customInput}
    <br />
    <label style:padding-right="20px"
      >{$_('parameters_width')}
      <PixelNumber>
        <input
          type="number"
          min="1"
          max={MAX_SIZE}
          {disabled}
          bind:value={spectrum.width}
          onchange={(e) => (spectrum.width = clamp(Number(e.currentTarget.value), 1, MAX_SIZE))}
        />
      </PixelNumber>
      <span>px</span>
    </label>
    <label style:padding-right="20px"
      >{$_('parameters_height')}
      <PixelNumber>
        <input
          type="number"
          min="1"
          max={MAX_SIZE}
          {disabled}
          bind:value={spectrum.height}
          onchange={(e) => (spectrum.height = clamp(Number(e.currentTarget.value), 1, MAX_SIZE))}
        />
      </PixelNumber>
      <span>px</span>
    </label>
  {/if}
</div>
