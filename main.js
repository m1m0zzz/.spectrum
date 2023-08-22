const DEFAULT_LANG = "ja";
const LANGUAGES = ["ja", "en"];

const img = new Image();
let imageData;
let memoAlpha;
let logToPixelIndexMap;
let audioContext;
let nodeAnalyser;

// parameters
let fftSize;
let spectrumType;
let spectrumSensitivity;
let spectrumGridSize;
let isDoPixelation;
let pixelationSize;

// - logic ----------------------------------------------------------------

const getRGBAbyImageData = (imageData, x, y, width) => {
  return [
    imageData.data[(x + y * width) * 4],
    imageData.data[(x + y * width) * 4 + 1],
    imageData.data[(x + y * width) * 4 + 2],
    imageData.data[(x + y * width) * 4 + 3] / 255
  ];
}

const generateLogToPixelIndexMap = (fftSize, imageWidth) => {
  let map = structuredClone([...Array(imageWidth)].map(() => { return { begin: null, end: null }}));
  let count = 0;
  map[0].begin = 0;

  for (let i = 0; i < fftSize / 2; i++) {
    // cf. (w / imageWidth) * (count + 1) < Math.log(i) / Math.log(fftSize / 2) * w
    if (count + 1 < Math.log(i) / Math.log(fftSize / 2) * imageWidth) {
      map[count].end = i - 1;
      count++;
      map[count].begin = i;
      if (count >= imageWidth) {
        break;
      }
    }
  }
  if (!map[map.length - 1].end) {
    map[map.length - 1].end = fftSize / 2 - 1;
  }
  return structuredClone(map);
}

// ピクセル化(サンプリング) (pixelSizeの大きさ)
const executePixelationSampling = (context, img, pixelSize) => {
  const newWidth = Math.floor(img.width / pixelSize);
  const newHeight = Math.floor(img.height / pixelSize);

  // draw original image
  context.canvas.width = img.width;
  context.canvas.height = img.height;
  context.drawImage(img, 0, 0);

  let imageData = context.getImageData(0, 0, img.width, img.height);
  let newImageData = new ImageData(newWidth, newHeight);

  for (let y = 0; y < img.height; y += pixelSize) {
    for (let x = 0; x < img.width; x += pixelSize) {

      let red = imageData.data[((img.width * y) + x) * 4];
      let green = imageData.data[((img.width * y) + x) * 4 + 1];
      let blue = imageData.data[((img.width * y) + x) * 4 + 2];
      let alpha = imageData.data[((img.width * y) + x) * 4 + 3];

      newImageData.data[((newWidth * (y / pixelSize)) + (x / pixelSize)) * 4] = red;
      newImageData.data[((newWidth * (y / pixelSize)) + (x / pixelSize)) * 4 + 1] = green;
      newImageData.data[((newWidth * (y / pixelSize)) + (x / pixelSize)) * 4 + 2] = blue;
      newImageData.data[((newWidth * (y / pixelSize)) + (x / pixelSize)) * 4 + 3] = alpha;
     }
  }

  context.canvas.width = newWidth;
  context.canvas.height = newHeight;
  context.putImageData(newImageData, 0, 0);

  return newImageData;
}

// - event handler ----------------------------------------------------------------

const uploadSound = () => {
  const audioElement = document.querySelector("audio");
  const file = document.querySelector("input[type=file]#audio-input").files[0];
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    audioElement.src = reader.result;

    if (!audioContext) { // init audio context
      audioContext = new AudioContext();
      nodeAnalyser = audioContext.createAnalyser();
      nodeAnalyser.fftSize = fftSize;

      // 0～1の範囲でデータの動きの速さ 0だともっとも速く、1に近づくほど遅くなる
      nodeAnalyser.smoothingTimeConstant = 0.85;
      nodeAnalyser.connect(audioContext.destination);

      let nodeSource = audioContext.createMediaElementSource(audioElement);
      nodeSource.connect(nodeAnalyser);
    }
  }, false);

  if (file) { reader.readAsDataURL(file); }
}

const setImageErrorMassage = (boolean) => {
  const imgError = document.querySelector("#img-error");
  imgError.style.display = boolean ? "block" : "none";
}

const uploadImage = () => {
  const file = document.querySelector("input[type=file]#image-input").files[0];
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    const previewCanvas = document.querySelector("#preview");
    const previewCtx = previewCanvas.getContext("2d");
    const imgInfoWidth = document.querySelector("#img-info-width");
    const imgInfoHeight = document.querySelector("#img-info-height");
    const previewContainer = document.querySelector(".img-preview-container");

    img.src = reader.result; // base64

    img.onload = () => {
      if (img.width * img.height > 256 * 256) {
        setImageErrorMassage(true);
        togglePixelation(true);
      } else {
        setImageErrorMassage(false);
        togglePixelation(false);
      }

      imgInfoWidth.textContent = String(img.width);
      imgInfoHeight.textContent = String(img.height);
      previewContainer.style.display = "block";
      previewCanvas.width = img.width;
      previewCanvas.height = img.height;
      previewCtx.drawImage(img, 0, 0);

      if (isDoPixelation) {
        pixelationSizeHandler(pixelationSize); // TODO: [refactor] pixelationSizeHandlerを使用せず ピクセル化する
      } else {
        imageData = previewCtx.getImageData(0, 0, img.width, img.height);
        updateAssociatedWithImageData(imageData.width, imageData.height);
      }
    };
  }, false);

  if (file) { reader.readAsDataURL(file); }
}

const updateAssociatedWithImageData = (imgWidth, imgHeight) => {
  memoAlpha = Array(imgWidth * imgHeight).fill(0);
  logToPixelIndexMap = generateLogToPixelIndexMap(fftSize, imgHeight);
}

const fftSizeHandler = (value) => {
  if (nodeAnalyser) {
    nodeAnalyser.fftSize = value;
  }
  if (img.src !== "") {
    logToPixelIndexMap = generateLogToPixelIndexMap(value, imageData.width);
  }
}

const togglePixelation = (boolean) => {
  const pixelationDo = document.querySelector("#pixelation-do");
  const pixelationDoNot = document.querySelector("#pixelation-do-not");

  if ((boolean && !pixelationDo.classList.contains("action-link")) ||
      (!boolean && !pixelationDoNot.classList.contains("action-link"))) {
    return;
  }

  pixelationDo.classList.toggle("action-link");
  pixelationDoNot.classList.toggle("action-link");
  pixelationDo.classList.toggle("pixelation-active");
  pixelationDoNot.classList.toggle("pixelation-active");
  isDoPixelation = boolean;
  if (isDoPixelation) {
    pixelationDo.textContent = ">" + pixelationDo.textContent
    pixelationDoNot.textContent = pixelationDoNot.textContent.replace(">", "");
    document.querySelector("#pixelation-setting").style.display = "block";

    pixelationSizeHandler(pixelationSize); // TODO: [refactor] pixelationSizeHandlerを使用せず ピクセル化する
  } else {
    pixelationDoNot.textContent = ">" + pixelationDoNot.textContent
    pixelationDo.textContent = pixelationDo.textContent.replace(">", "");
    document.querySelector("#pixelation-setting").style.display = "none";
  }
}

const pixelationSizeHandler = (value) => {
  pixelationSize = Math.max(2, value);

  if (img.src !== "") {
    const pixelationBeforeSize = document.querySelector("#pixelation-before-size");
    const pixelationAfterSize = document.querySelector("#pixelation-after-size");

    pixelationBeforeSize.textContent = `（ ${img.width} px × ${img.width} px ）`;
    pixelationAfterSize.textContent = `（ ${Math.floor(img.width / pixelationSize)} px × ${Math.floor(img.width / pixelationSize)} px ）`;

    if (isDoPixelation) {
      const previewCanvas = document.querySelector("#preview");
      const previewCtx = previewCanvas.getContext("2d");

      imageData = executePixelationSampling(previewCtx, img, pixelationSize);
      updateAssociatedWithImageData(imageData.width, imageData.height);
    }
  }

  return pixelationSize;
}

const toggleVersionInfo = () => {
  const versionInfo = document.querySelector("#version-info");
  versionInfo.style.display = versionInfo.style.display === "block" ? "none" : "block";
}

const translateLang = (lang) => {
  if (!LANGUAGES.includes(lang)) return;

  document.querySelectorAll(`[data-lang-${lang}]`).forEach((elm) => {
    if (!elm.hasAttribute(`data-lang-${DEFAULT_LANG}`)) { // 最初の変更時のみ
      elm.setAttribute(`data-lang-${DEFAULT_LANG}`, elm.textContent)
    }
    if (elm.hasAttribute(`data-lang-${lang}`)) {
      elm.textContent = elm.getAttribute(`data-lang-${lang}`);
    }
  })
}

const changeFullScreen = () => {
  if (!document.fullscreenEnabled) return;

  console.log("to full screen");
  const playerCanvas = document.querySelector("#player");
  playerCanvas.requestFullscreen();
}

// - main ----------------------------------------------------------------

window.onload = () => {
  const playerCanvas = document.querySelector("#player");
  const playerCtx = playerCanvas.getContext("2d");
  if (document.fullscreenEnabled) {
    document.querySelector("#full-screen-error").style.display = "none";
  } else {
    document.querySelector("#full-screen-button").setAttribute("disabled", true);
  }
  pixelationSize = document.querySelector("#pixelation-size").value;
  spectrumType = document.querySelector("#spectrum-type").value;
  fftSize = Number(document.querySelector("#spectrum-fft-size").value);
  spectrumSensitivity = Number(document.querySelector("#spectrum-sensitivity").value);
  spectrumGridSize = Number(document.querySelector("#spectrum-grid-size").value);
  spectrumSmoothTime = Number(document.querySelector("#spectrum-smooth-time").value);

  const draw = () => {
    requestAnimationFrame(draw);

    const w = playerCanvas.width;
    const h = playerCanvas.height;
    playerCtx.clearRect(0, 0, w, h);

    if (!nodeAnalyser) return;
    const freqByteData = new Uint8Array(fftSize / 2);
    nodeAnalyser.getByteFrequencyData(freqByteData);

    if (spectrumType === "pixel") {
      if (img.src !== "") {
        const cellWidth = w / imageData.width;
        const cellHeight = h / imageData.height;

        // note
        // spectrumSmoothTime ... 1sec -> 30fr -> 1/30
        // spectrumSmoothTime ... 1000msec -> 30fr -> 1/60
        // spectrumSmoothTime ... 2sec -> 60fr -> 1/60
        const fps = 30;
        const alphaDecrement = (spectrumSmoothTime <= 0) ? 1 : 1000 / (spectrumSmoothTime * fps);

        for (let x = 0; x < imageData.width; x++) {
          const begin = logToPixelIndexMap[x].begin;
          const end = logToPixelIndexMap[x].end; // TODO; [bug] 特定の画像のときに .end が設定されていない
          const sum = freqByteData.slice(begin, end + 1).reduce((sum, num) => sum + num, 0);
          const ave = sum / (end - begin + 1) / 256;
          const gridSize = spectrumGridSize/ 2

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
        playerCtx.font = "32px";
        playerCtx.fillText("No Image", 20, 20);
        playerCtx.fillStyle = "black";
      }
    } else {
      playerCtx.beginPath();

      for (let i = 0; i < freqByteData.length; i++) {
        const freqSum = freqByteData[i] / 256;

        if (spectrumType === "log") {
          playerCtx.rect(
            Math.log(i) / Math.log(freqByteData.length) * w, (1 - freqSum) * h,
            1, freqSum * h
          )
        } else if (spectrumType === "liner") {
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
  draw();
}
