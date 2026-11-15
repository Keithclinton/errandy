const MAX_DIMENSION = 1600;
// The API takes up to 1 MB per photo; staying under this leaves room to spare.
const TARGET_BYTES = 800_000;

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
 * Turns a phone photo (often 3–10 MB) into a JPEG data URL under ~800 KB, at most 1600px on
 * its longest side: still sharp enough to read an ID card, small enough to upload quickly.
 * Throws if the browser can't read the file as an image.
 */
export async function compressPhoto(file: File): Promise<string> {
  const img = await loadImage(await readAsDataUrl(file));
  for (const maxDimension of [MAX_DIMENSION, 1200]) {
    const canvas = render(img, maxDimension);
    for (const quality of [0.85, 0.7, 0.55]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrlBytes(dataUrl) <= TARGET_BYTES) return dataUrl;
    }
  }
  return render(img, 1000).toDataURL("image/jpeg", 0.5);
}
