// The contract every image provider implements: the real API, and a test double that only
// runs off Vercel (providers/fixture.ts).

export type ImageRequest = {
  modelRef: string;
  prompt: string;
  signal?: AbortSignal;
};

export type ImageResult = {
  bytes: Buffer;
  contentType: string;
  width: number;
  height: number;
};

// Failure classes the job runner acts on differently.
export type ProviderErrorCode =
  | "quota_exhausted" // daily free allocation used up: fail, refund, say when it resets
  | "rate_limited" // transient capacity/rate limit: fail, refund, try again shortly
  | "content_flagged" // provider moderation rejected the output: refund, ask for another prompt
  | "bad_request" // our request was invalid: refund
  | "provider_error" // 5xx, network, timeout: refund
  | "not_configured"; // no credentials: fail and refund

export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
  }
}

export interface ImageProvider {
  key: string;
  generate(req: ImageRequest): Promise<ImageResult>;
}
