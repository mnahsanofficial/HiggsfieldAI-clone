import "server-only";
import sharp from "sharp";

// FLUX.1 schnell only outputs 1024x1024. Other aspect ratios are a centre crop of that
// square: a real transform, labelled as such in the UI. Everything is re-encoded to a
// high-quality JPEG (the provider's JPEGs are ~750 KB; this keeps Blob usage sane).

export function aspectDims(aspect: string, base = 1024): { width: number; height: number } {
  const [w, h] = aspect.split(":").map(Number);
  if (!w || !h) return { width: base, height: base };
  return w >= h ? { width: base, height: Math.round((base * h) / w) } : { width: Math.round((base * w) / h), height: base };
}

export async function cropToAspect(bytes: Buffer, aspect: string): Promise<{ bytes: Buffer; width: number; height: number; cropped: boolean }> {
  const { width, height } = aspectDims(aspect);
  const out = await sharp(bytes)
    .resize(width, height, { fit: "cover", position: "centre" })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
  return { bytes: out, width, height, cropped: width !== height };
}
