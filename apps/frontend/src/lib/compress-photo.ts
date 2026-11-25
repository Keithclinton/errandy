/** The size each kind of photo is shrunk to. The API takes up to 1 MB per photo. */
export const PHOTO_SIZES = {
  /** ID checks: still sharp enough to read an ID card. */
  idCheck: { maxDimension: 1600, targetBytes: 800_000 },
  /** Listing and portfolio photos: fills a phone or laptop screen, loads fast on mobile data. */
  photo: { maxDimension: 1280, targetBytes: 350_000 },
  /** Profile photos, only ever shown small. */
  avatar: { maxDimension: 512, targetBytes: 120_000 },
} as const;

export type PhotoSize = (typeof PHOTO_SIZES)[keyof typeof PHOTO_SIZES];

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("unreadable-image"));
    img.src = src;
  });
}

function dataUrlBytes(dataUrl: string): number {
  return Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);
}

function render(img: HTMLImageElement, maxDimension: number): HTMLCanvasElement {
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no-canvas");
  ctx.fillStyle = "#fff"; // transparent PNG areas would otherwise turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Turns a phone photo (often 3–10 MB) into a JPEG data URL of about `targetBytes` at most, no
 * more than `maxDimension` pixels on its longest side (ID checks by default). Throws if the
 * browser can't read the file as an image.
 */
export async function compressPhoto(file: File, { maxDimension, targetBytes }: PhotoSize = PHOTO_SIZES.idCheck): Promise<string> {
  const img = await loadImage(await readAsDataUrl(file));
  for (const dimension of [maxDimension, Math.round(maxDimension * 0.75)]) {
    const canvas = render(img, dimension);
    for (const quality of [0.85, 0.7, 0.55]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrlBytes(dataUrl) <= targetBytes) return dataUrl;
    }
  }
  return render(img, Math.round(maxDimension * 0.6)).toDataURL("image/jpeg", 0.5);
}
