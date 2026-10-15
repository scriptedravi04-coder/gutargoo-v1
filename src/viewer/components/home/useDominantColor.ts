// Average colour of an image (the app tints the Home header with the current banner's colour).
import { useEffect, useState } from "react";

export const FALLBACK_COLOR = "#1a1a1a";
const cache = new Map<string, string>();

function averageColor(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const size = 16;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(FALLBACK_COLOR);
        ctx.drawImage(img, 0, 0, size, size);
        const px = ctx.getImageData(0, 0, size, size).data; // throws if the canvas is tainted (no CORS)
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 16) continue;
          r += px[i];
          g += px[i + 1];
          b += px[i + 2];
          n++;
        }
        if (!n) return resolve(FALLBACK_COLOR);
        resolve(`rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`);
      } catch {
        resolve(FALLBACK_COLOR);
      }
    };
    img.onerror = () => resolve(FALLBACK_COLOR);
    img.src = src;
  });
}

export function useDominantColor(src?: string): string {
  const [color, setColor] = useState(() => (src && cache.get(src)) || FALLBACK_COLOR);
  useEffect(() => {
    if (!src) {
      setColor(FALLBACK_COLOR);
      return;
    }
    const hit = cache.get(src);
    if (hit) {
      setColor(hit);
      return;
    }
    let alive = true;
    averageColor(src).then((c) => {
      cache.set(src, c);
      if (alive) setColor(c);
    });
    return () => {
      alive = false;
    };
  }, [src]);
  return color;
}
