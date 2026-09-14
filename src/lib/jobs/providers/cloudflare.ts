import "server-only";
import { type ImageProvider, type ImageRequest, type ImageResult, ProviderError } from "./types";

// Cloudflare Workers AI, free tier (10,000 Neurons/day; FLUX.1 schnell ~58 per image).
// Verified against the live API: flux-1-schnell accepts { prompt, steps } and rejects
// `seed` despite the docs (error 5006); it returns a 1024x1024 JPEG as base64.

const TIMEOUT_MS = 45_000;

export const cloudflareProvider: ImageProvider = {
  key: "cloudflare",

  async generate({ modelRef, prompt, signal }: ImageRequest): Promise<ImageResult> {
    const account = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;
    if (!account || !token) throw new ProviderError("not_configured", "Image provider credentials are not configured");

    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${modelRef}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.slice(0, 2048), steps: 4 }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (err) {
      throw new ProviderError("provider_error", "Image provider did not respond", String(err));
    }

    type CfBody = { success?: boolean; result?: { image?: string }; errors?: { code?: number; message?: string }[] };
    let body: CfBody = {};
    try {
      body = (await res.json()) as CfBody;
    } catch {
      /* non-JSON error page */
    }

    const image = body.result?.image;
    if (res.ok && body.success !== false && image) {
      return { bytes: Buffer.from(image, "base64"), contentType: "image/jpeg", width: 1024, height: 1024 };
    }
    throw classify(res.status, body.errors ?? []);
  },
};

function classify(status: number, errors: { code?: number; message?: string }[]): ProviderError {
  const codes = errors.map((e) => e.code);
  const message = errors.map((e) => e.message).join("; ") || `HTTP ${status}`;
  const lower = message.toLowerCase();
  if (codes.includes(4006) || lower.includes("daily free allocation") || lower.includes("neurons")) {
    return new ProviderError("quota_exhausted", "Today's free image quota is used up", { status, codes, message });
  }
  if (status === 429 || codes.includes(3040) || lower.includes("capacity") || lower.includes("rate limit")) {
    return new ProviderError("rate_limited", "The image provider is busy", { status, codes, message });
  }
  if (codes.includes(3030) || lower.includes("flagged")) {
    return new ProviderError("content_flagged", "The provider's safety filter rejected this image", { status, codes, message });
  }
  if (status >= 400 && status < 500) {
    return new ProviderError("bad_request", "The image provider rejected the request", { status, codes, message });
  }
  return new ProviderError("provider_error", "The image provider failed", { status, codes, message });
}
