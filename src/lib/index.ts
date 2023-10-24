export const spectrumTypes = ["liner", "log", "pixel"] as const;
export type SpectrumType = typeof spectrumTypes[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isSpectrumType = (arg: any): arg is SpectrumType => {
  return spectrumTypes.indexOf(arg) !== -1;
}

export type LogToPixelIndexMap = {
  begin: number | null;
  end: number | null;
}[];

export const generateLogToPixelIndexMap = (fftSize: number, imageWidth: number) => {
  const map: LogToPixelIndexMap = structuredClone([...Array(imageWidth)].map(() => { return { begin: null, end: null }}));
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

// utility

export const clamp = (num: number, min: number, max: number) => {
  return Math.max(min, Math.min(num, max));
}

export const padding = (size: number, numString: number | string) => {
  return ("0".repeat(size) + String(numString)).slice(-size)
}

export const formatDate = (date: Date) => {
  const Y = date.getFullYear();
  const M = padding(2, date.getMonth() + 1);
  const D = padding(2, date.getDate());
  const h = padding(2, date.getHours());
  const m = padding(2, date.getMinutes());
  const s = padding(2, date.getSeconds());
  return (Y + "_" + M + "_" + D + "_" + h + "_" + m + "_" + s);
}

export const capitalize = (str: string) => {
  return str[0].toUpperCase() + str.slice(1);
}
