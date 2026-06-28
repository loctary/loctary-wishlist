/**
 * Client-side item-image processing: render the user's selected 4:3 region to a
 * canvas, then encode WebP (or JPEG fallback) stepping size + quality down until
 * the result is ≤ 300 KB. The server enforces the same cap.
 *
 * Lifted from loctary-auth's `getCroppedAvatar` (square, smaller dims) — the
 * differences are the 4:3 aspect, the larger long edge (cards are wider than
 * avatars), and a dimension ladder picked for that aspect.
 */

const MAX_BYTES = 300 * 1024;
const FORMATS = ["image/webp", "image/jpeg"] as const;
/** 4:3 dimension ladder, widest first. Each step is (width, height). */
const DIMS: Array<[number, number]> = [
  [1024, 768],
  [800, 600],
  [640, 480],
  [512, 384],
];

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image."));
    img.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * @returns a 4:3 WebP (or JPEG fallback) Blob ≤ 300 KB cropped to `area`.
 * @throws if the canvas/image encoding is unavailable.
 */
export async function getCroppedItemImage(src: string, area: CropArea): Promise<Blob> {
  const image = await loadImage(src);

  let last: Blob | null = null;
  for (const [w, h] of DIMS) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image editing is not supported in this browser.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, w, h);

    for (const format of FORMATS) {
      for (const quality of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
        const blob = await toBlob(canvas, format, quality);
        // Browsers that can't encode this format ignore it and return another
        // type (usually PNG) — only accept a blob that's actually `format`.
        if (!blob || blob.type !== format) break; // unsupported here → next format
        last = blob;
        if (blob.size <= MAX_BYTES) return blob;
      }
    }
  }

  if (!last) throw new Error("Could not process the image.");
  return last; // smallest we could produce — server will reject if still too big
}
