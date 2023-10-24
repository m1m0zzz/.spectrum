export const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = reject;
});

export const loadImage = (src: string) =>  new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = (e) => reject(e);
  img.src = src;
});

export const getRGBAbyImageData = (imageData: ImageData, x: number, y: number, width: number) => {
  return [
    imageData.data[(x + y * width) * 4],
    imageData.data[(x + y * width) * 4 + 1],
    imageData.data[(x + y * width) * 4 + 2],
    imageData.data[(x + y * width) * 4 + 3] / 255
  ];
}

// ピクセル化(サンプリング) (pixelSizeの大きさ)
export const executePixelationSampling = (context: CanvasRenderingContext2D, img: HTMLImageElement, pixelSize: number) => {
  const newWidth = Math.floor(img.width / pixelSize);
  const newHeight = Math.floor(img.height / pixelSize);

  // draw original image
  context.canvas.width = img.width;
  context.canvas.height = img.height;
  context.drawImage(img, 0, 0);

  const imageData = context.getImageData(0, 0, img.width, img.height);
  const newImageData = new ImageData(newWidth, newHeight);

  for (let y = 0; y < img.height; y += pixelSize) {
    for (let x = 0; x < img.width; x += pixelSize) {

      const red = imageData.data[((img.width * y) + x) * 4];
      const green = imageData.data[((img.width * y) + x) * 4 + 1];
      const blue = imageData.data[((img.width * y) + x) * 4 + 2];
      const alpha = imageData.data[((img.width * y) + x) * 4 + 3];

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
