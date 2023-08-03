const FFT_SIZE = 1024;

const img = new Image();
let playerCanvas;
let playerCtx;
let audioContext;
let nodeAnalyser;
let spectrumType;

const uploadSound = () => {
  const audioElement = document.querySelector("audio");
  const file = document.querySelector("input[type=file]#audio-input").files[0];
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    audioElement.src = reader.result;

    if (!audioContext) { // init audio context
      audioContext = new AudioContext();
      nodeAnalyser = audioContext.createAnalyser();
      nodeAnalyser.fftSize = FFT_SIZE;

      // 0～1の範囲でデータの動きの速さ 0だともっとも速く、1に近づくほど遅くなる
      nodeAnalyser.smoothingTimeConstant = 0.85;
      nodeAnalyser.connect(audioContext.destination);

      let nodeSource = audioContext.createMediaElementSource(audioElement);
      nodeSource.connect(nodeAnalyser);
    }
  }, false);

  if (file) { reader.readAsDataURL(file); }
}

const uploadImage = () => {
  const file = document.querySelector("input[type=file]#image-input").files[0];
  const reader = new FileReader();

  reader.addEventListener("load", () => {
    const previewCanvas = document.querySelector("#preview");
    const previewCtx = previewCanvas.getContext("2d");
    const imgInfo = document.querySelector("#img-info");

    img.src = reader.result; // base64

    img.onload = () => {
      previewCanvas.width = Math.max(img.width, 100);
      previewCanvas.height = Math.max(img.height, 100);
      imgInfo.textContent = `幅: ${img.width}px, 高さ: ${img.height}px`
      if (img.width < 100) {
        previewCtx.drawImage(img, 0, 0, 100, img.height * 100 / img.width);
      } else {
        previewCtx.drawImage(img, 0, 0);
      }
    };
  }, false);

  if (file) { reader.readAsDataURL(file); }
}

const spectrumTypeHandler = (value) => {
  spectrumType = value;
  console.log(spectrumType);
}

window.onload = () => {
  playerCanvas = document.querySelector("#player");
  playerCtx = playerCanvas.getContext("2d");
  spectrumType = document.querySelector("#spectrum-type").value;

  const draw = () => {
    requestAnimationFrame(draw);

    const w = playerCanvas.width;
    const h = playerCanvas.height;
    playerCtx.clearRect(0, 0, w, h);


    if (!nodeAnalyser) return;

    const freqByteData = new Uint8Array(FFT_SIZE / 2);
    nodeAnalyser.getByteFrequencyData(freqByteData);

    playerCtx.beginPath();

    let memoW = 0;
    for (let i = 0; i < freqByteData.length; i++) {
      const freqSum = freqByteData[i] / 256;

      if (spectrumType === "log") {
        playerCtx.rect(
          Math.log(i) / Math.log(freqByteData.length) * w, (1 - freqSum) * h,
          2, freqSum * h
        )
      } else { // liner
        playerCtx.rect(
          w / freqByteData.length * i, (1 - freqSum) * h,
          w / freqByteData.length, freqSum * h
        )
      }
    }
    playerCtx.fillStyle = "lightskyblue";
    playerCtx.fill();
  }

  draw();
}

