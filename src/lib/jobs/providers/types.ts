// The contract every image provider implements. A real API and the simulated
// fallback are interchangeable behind it.

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
  | "quota_exhausted" // daily free allocation used up: refund and serve a labelled sample
  | "rate_limited" // transient capacity/rate limit: refund and serve a labelled sample
  | "content_flagged" // provider moderation rejected the output: refund, ask for another prompt
  | "bad_request" // our request was invalid: refund
  | "provider_error" // 5xx, network, timeout: refund
  | "not_configured"; // no credentials: refund and serve a labelled sample

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
