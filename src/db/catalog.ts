import type { ModelCapabilities, ModelPricing, PresetMotion } from "./schema";

// Seed catalog. Plans mirror recon capture 23 (credits, prices, tier order); the
// "free" plan is ours, since the capture shows no free tier. Models are only ones
// this app really runs: nothing here is renamed to look like a model it isn't.

// Demo promo codes seeded into promo_codes. AHSAN345 takes the whole price off, which is
// honest about what the demo checkout does: nothing is ever charged, with or without a code.
export const PROMO_CODES = [{ code: "AHSAN345", percentOff: 100, active: true, note: "Reviewer code: full discount on the demo checkout" }];

export const PLANS = [
  {
    id: "free",
    name: "Free",
    tagline: "What every account starts on",
    rank: 0,
    imagesPerDay: 5,
    monthlyCreditsTenths: 0,
    priceMonthlyCents: 0,
    priceAnnualCents: 0,
  },
  {
    id: "basic",
    name: "Basic",
    tagline: "Enough to try the whole loop",
    rank: 1,
    imagesPerDay: 10,
    monthlyCreditsTenths: 1200,
    priceMonthlyCents: 900,
    priceAnnualCents: 900,
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For making something most days",
    rank: 2,
    imagesPerDay: 15,
    monthlyCreditsTenths: 6000,
    priceMonthlyCents: 2900,
    priceAnnualCents: 2000,
  },
  {
    id: "max",
    name: "Max",
    tagline: "For the most images a day",
    rank: 3,
    imagesPerDay: 20,
    monthlyCreditsTenths: 18000,
    priceMonthlyCents: 7900,
    priceAnnualCents: 4500,
  },
] as const;

type ModelSeed = {
  id: string;
  name: string;
  vertical: "image" | "video";
  badge: "top" | "new" | null;
  description: string;
  providerKey: string;
  providerModelRef: string;
  isModelGenerated: boolean;
  minPlanRank: number;
  capabilities: ModelCapabilities;
  pricing: ModelPricing;
  active: boolean;
  sort: number;
};

export const MODELS: ModelSeed[] = [
  {
    id: "flux_1_schnell",
    name: "FLUX.1 [schnell]",
    vertical: "image",
    badge: "top",
    description: "Fast, sharp text-to-image by Black Forest Labs",
    providerKey: "cloudflare",
    providerModelRef: "@cf/black-forest-labs/flux-1-schnell",
    isModelGenerated: true,
    minPlanRank: 0,
    // The model outputs 1024x1024 only; other aspects are a labelled server-side crop.
    capabilities: { aspects: ["1:1", "16:9", "9:16", "4:3", "3:4"], resolutions: ["1K"], maxBatch: 4, acceptsImageInput: false },
    pricing: { baseTenths: 20, listMultiplier: 1.3 },
    active: true,
    sort: 0,
  },
  {
    id: "flux_2_klein_4b",
    name: "FLUX.2 [klein] 4B",
    vertical: "image",
    badge: "new",
    description: "Distilled FLUX.2 for quick, detailed images",
    providerKey: "cloudflare",
    providerModelRef: "@cf/black-forest-labs/flux-2-klein-4b",
    isModelGenerated: true,
    minPlanRank: 2,
    capabilities: { aspects: ["1:1"], resolutions: ["1K"], maxBatch: 4, acceptsImageInput: false },
    pricing: { baseTenths: 35, listMultiplier: 1.3 },
    // Enabled in feat/generation-jobs once its parameters and output are verified.
    active: false,
    sort: 1,
  },
  {
    id: "camera_motion",
    name: "Camera motion",
    vertical: "video",
    badge: "top",
    description: "Real camera moves rendered over your image",
    providerKey: "render",
    providerModelRef: "ffmpeg-camera-v1",
    isModelGenerated: false,
    minPlanRank: 0,
    // Live renders are limited to 720p and 5s: every render is real CPU inside a Vercel
    // Function, and the Hobby Fluid Active CPU allowance (4h/month) was exhausted during the
    // build. Pricing keeps the 1080p/10s multipliers for when capacity allows re-enabling them.
    capabilities: {
      aspects: ["16:9", "9:16", "1:1"],
      resolutions: ["720p"],
      durations: [5],
      maxBatch: 1,
      acceptsImageInput: true,
    },
    // Anchored to recon capture 17: 5s at 1080p shows 80 struck through, 45 charged.
    pricing: { baseTenths: 300, listMultiplier: 1.78, resolution: { "720p": 1, "1080p": 1.5 }, duration: { "5": 1, "10": 1.8 } },
    active: true,
    sort: 0,
  },
];

type PresetSeed = {
  id: string;
  name: string;
  category: string;
  description: string;
  motion: PresetMotion;
  featured: boolean;
  sort: number;
};

// Every preset is a transform the renderer genuinely performs on a flat image.
// Moves that need depth (true orbit, dolly zoom) are absent or labelled as what they are.
export const PRESETS: PresetSeed[] = [
  { id: "general", name: "General", category: "push", description: "A gentle, steady push toward the subject", motion: { type: "push", params: { zoomTo: 1.12, easing: "inOut" } }, featured: true, sort: 0 },
  { id: "slow-push-in", name: "Slow push-in", category: "push", description: "Creeping move that builds tension", motion: { type: "push", params: { zoomTo: 1.25, easing: "inOut" } }, featured: true, sort: 1 },
  { id: "crash-zoom", name: "Crash zoom", category: "push", description: "Fast punch-in for impact", motion: { type: "push", params: { zoomTo: 1.8, easing: "in" } }, featured: true, sort: 2 },
  { id: "pull-out-reveal", name: "Pull-out reveal", category: "push", description: "Starts tight and opens up the frame", motion: { type: "pull", params: { zoomFrom: 1.4, easing: "out" } }, featured: true, sort: 3 },
  { id: "pan-left", name: "Pan left", category: "pan", description: "Lateral move across the scene, right to left", motion: { type: "pan", params: { direction: "left", travel: 0.18 } }, featured: false, sort: 4 },
  { id: "pan-right", name: "Pan right", category: "pan", description: "Lateral move across the scene, left to right", motion: { type: "pan", params: { direction: "right", travel: 0.18 } }, featured: true, sort: 5 },
  { id: "tilt-up", name: "Tilt up", category: "pan", description: "Rises from ground to sky", motion: { type: "tilt", params: { direction: "up", travel: 0.2 } }, featured: false, sort: 6 },
  { id: "tilt-down", name: "Tilt down", category: "pan", description: "Descends onto the subject", motion: { type: "tilt", params: { direction: "down", travel: 0.2 } }, featured: false, sort: 7 },
  { id: "arc-pan-left", name: "Arc pan left", category: "arc", description: "Curved pan with a slight roll. A 2D arc, not a true orbit", motion: { type: "arc", params: { direction: "left", travel: 0.16, rollDeg: 3 } }, featured: true, sort: 8 },
  { id: "arc-pan-right", name: "Arc pan right", category: "arc", description: "Curved pan with a slight roll. A 2D arc, not a true orbit", motion: { type: "arc", params: { direction: "right", travel: 0.16, rollDeg: 3 } }, featured: false, sort: 9 },
  { id: "handheld", name: "Handheld", category: "handheld", description: "Documentary-style camera shake", motion: { type: "handheld", params: { intensity: 0.5 } }, featured: true, sort: 10 },
  { id: "handheld-push", name: "Handheld push", category: "handheld", description: "Shaky walk toward the subject", motion: { type: "handheld", params: { intensity: 0.4, zoomTo: 1.2 } }, featured: false, sort: 11 },
  { id: "rack-focus-in", name: "Rack focus in", category: "focus", description: "Blurred frame pulls into sharp focus", motion: { type: "rack_focus", params: { from: "blur", to: "sharp" } }, featured: true, sort: 12 },
  { id: "rack-focus-out", name: "Rack focus out", category: "focus", description: "Sharp frame drifts out of focus", motion: { type: "rack_focus", params: { from: "sharp", to: "blur" } }, featured: false, sort: 13 },
];
