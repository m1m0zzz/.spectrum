<script lang="ts">
  import { clamp } from '#lib/util.ts';
  import PixelNumber from '#lib/components/PixelNumber.svelte';
  import { _ } from 'svelte-i18n';
  import PixelSelect from '#lib/components/PixelSelect.svelte';

  export let playerWidth: number;
  export let playerHeight: number;
  // スペクトラムに使う画像（トリミング・ドット化の後）の大きさ。読み込む前は 0
  export let imageWidth = 0;
  export let imageHeight = 0;
  // 動画の作成中はキャンバスの大きさを変えられないようにする
  export let disabled = false;

  // キャンバスの最大の幅・高さ
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
  let sizeValue = '360';
  $: customInput = sizeValue == 'custom';
  $: sizeOptions = [
    ...HEIGHTS.map((height) => ({
      value: String(height),
      label: `${height}h (${widthFor(height, imageWidth, imageHeight)}×${height})`
    })),
    { value: 'custom', label: $_('parameters_custom') }
  ];

  // 大きさを選んだときと、画像（の大きさ）が変わったときに、キャンバスの大きさを決め直す。
  // カスタムは、画像の大きさを既定にする（その後に手で変えた値は、次に画像が変わるまで保つ）
  const applySize = (value: string, width: number, height: number) => {
    if (value == 'custom') {
      if (width > 0 && height > 0) {
        playerWidth = clamp(width, 1, MAX_SIZE);
        playerHeight = clamp(height, 1, MAX_SIZE);
      }
    } else {
      playerHeight = Number(value);
      playerWidth = widthFor(playerHeight, width, height);
    }
  };
  $: applySize(sizeValue, imageWidth, imageHeight);

  // NOTE: canvas size
  // https://developer.mozilla.org/ja/docs/Web/HTML/Element/canvas#キャンバスの最大寸法
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
          bind:value={playerWidth}
          on:change={(e) => (playerWidth = clamp(Number(e.currentTarget.value), 1, MAX_SIZE))}
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
          bind:value={playerHeight}
          on:change={(e) => (playerHeight = clamp(Number(e.currentTarget.value), 1, MAX_SIZE))}
        />
      </PixelNumber>
      <span>px</span>
    </label>
  {/if}
</div>
