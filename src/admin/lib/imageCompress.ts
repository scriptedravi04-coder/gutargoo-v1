// Shrinks big pictures in the browser before they are uploaded, so saving is faster and
// the server does not refuse the request as "too large".
//  - only when the file is over 1.5 MB or its long side is over 2000 px
//  - photos → JPEG (quality 0.85); pictures with transparency (e.g. title logos) stay PNG, just resized
//  - anything that fails (old browser, odd format) → the original file is used

const MAX_BYTES = 1.5 * 1024 * 1024;
const MAX_SIDE = 2000;
const JPEG_QUALITY = 0.85;

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read the image"));
    };
    img.src = url;
  });

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> =>
  new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch {
      resolve(null);
    }
  });

const hasTransparency = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  try {
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
    return false;
  } catch {
    return true; // can't tell → keep PNG to be safe
  }
};

const renamed = (name: string, ext: string) => `${name.replace(/\.[^.]+$/, "") || "image"}.${ext}`;

/** Returns a smaller copy of an image file when it is big; otherwise the same file. */
export async function compressImage(file: File): Promise<File> {
  if (typeof document === "undefined" || !file.type.startsWith("image/")) return file;
  // animated / vector formats would be broken by a canvas redraw
  if (/image\/(gif|svg\+xml)/.test(file.type)) return file;
  try {
    const img = await loadImage(file);
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    if (!w0 || !h0) return file;
    const long = Math.max(w0, h0);
    if (file.size <= MAX_BYTES && long <= MAX_SIDE) return file;

    const scale = Math.min(1, MAX_SIDE / long);
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);

    const mayHaveAlpha = /image\/(png|webp|avif)/.test(file.type);
    const keepPng = mayHaveAlpha && hasTransparency(ctx, w, h);

    let blob: Blob | null;
    let type: string;
    if (keepPng) {
      type = "image/png";
      blob = await toBlob(canvas, type);
    } else {
      type = "image/jpeg";
      if (mayHaveAlpha) {
        // fully opaque PNG/WebP → flatten on white so JPEG has no black areas
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
      }
      blob = await toBlob(canvas, type, JPEG_QUALITY);
    }
    if (!blob) return file;
    // not resized and no smaller → keep the original
    if (scale === 1 && blob.size >= file.size) return file;
    return new File([blob], renamed(file.name, type === "image/png" ? "png" : "jpg"), { type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
