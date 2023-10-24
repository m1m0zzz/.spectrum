<script lang="ts">
	import type { LogToPixelIndexMap, SpectrumType } from "$lib";
	import { getRGBAbyImageData } from "$lib/image";
	import { createEventDispatcher, onMount } from "svelte";

  const dispatch = createEventDispatcher();

  export let imageLoaded: boolean;
  export let imageData: ImageData;
  export let memoAlpha: number[];
  export let logToPixelIndexMap: LogToPixelIndexMap;
  export let nodeAnalyser: AnalyserNode | null;

  // parameters
  export let playerWidth: number;
  export let playerHeight: number;
  export let background: string;
  export let fftSize: number;
  export let spectrumType: SpectrumType;
  export let spectrumSensitivity: number;
  export let spectrumGridSize: number;
  export let spectrumSmoothTime: number;

  // visibility
  export let playerRef: HTMLCanvasElement | null;
  let playerCtx: CanvasRenderingContext2D;

  const draw = () => {
    if (!playerRef) return;
    requestAnimationFrame(draw);

    const w = playerRef.width;
    const h = playerRef.height;
    playerCtx.clearRect(0, 0, w, h);
    playerCtx.beginPath();
    playerCtx.rect(0, 0, w, h);
    playerCtx.fillStyle = background;
    playerCtx.fill();

    if (!nodeAnalyser) return;
    const freqByteData = new Uint8Array(fftSize / 2);
    nodeAnalyser.getByteFrequencyData(freqByteData);

    if (spectrumType == "pixel") {
      if (imageLoaded) {
        const cellWidth = w / imageData.width;
        const cellHeight = h / imageData.height;

        // note
        // spectrumSmoothTime ... 1sec -> 30fr -> 1/30
        // spectrumSmoothTime ... 1000msec -> 30fr -> 1/60
        // spectrumSmoothTime ... 2sec -> 60fr -> 1/60
        const fps = 30;
        const alphaDecrement = (spectrumSmoothTime <= 0) ? 1 : 1000 / (spectrumSmoothTime * fps);

        for (let x = 0; x < imageData.width; x++) {
          const begin = logToPixelIndexMap[x].begin as number;
          const end = logToPixelIndexMap[x].end as number;
          const sum = freqByteData.slice(begin, end + 1).reduce((sum, num) => sum + num, 0);
          const ave = sum / (end - begin + 1) / 256;
          const gridSize = spectrumGridSize/ 2;

          for (let y = 0; y < imageData.height; y++) {
            const rgba = getRGBAbyImageData(imageData, x, y, imageData.width);
            if (1 - (y / imageData.height) <= ave * spectrumSensitivity) {
              memoAlpha[y * imageData.height + x] = rgba[3];
            } else {
              memoAlpha[y * imageData.height + x] = Math.max(memoAlpha[y * imageData.height + x] - alphaDecrement, 0);
            }
            playerCtx.beginPath();
            playerCtx.rect(
              gridSize + cellWidth * x, gridSize + cellHeight * y,
              cellWidth - gridSize * 2, cellHeight - gridSize * 2
            );

            playerCtx.fillStyle = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${memoAlpha[y * imageData.height + x]})`;
            playerCtx.fill();
          }
        }
      } else {
        playerCtx.fillStyle = "white";
        playerCtx.fillText("No Image", 10, 20);
        playerCtx.fillStyle = "black";
      }
    } else { // liner or log
      playerCtx.beginPath();

      for (let i = 0; i < freqByteData.length; i++) {
        const freqSum = freqByteData[i] / 256;

        if (spectrumType == "log") {
          playerCtx.rect(
            Math.log(i) / Math.log(freqByteData.length) * w, (1 - freqSum) * h,
            1, freqSum * h
          )
        } else if (spectrumType == "liner") {
          playerCtx.rect(
            w / freqByteData.length * i, (1 - freqSum) * h,
            w / freqByteData.length, freqSum * h
          )
        }
      }

      playerCtx.fillStyle = "lightskyblue";
      playerCtx.fill();
    }
  }

  onMount(() => {
    playerCtx = playerRef?.getContext("2d") as CanvasRenderingContext2D;
    draw();

    dispatch("mount", {
      playerRef: playerRef
    })
  })
</script>

<section>
  <div class="canvas-container">
    <canvas id="player" bind:this={playerRef} width={playerWidth} height={playerHeight} style:background={background}></canvas>
  </div>
</section>
