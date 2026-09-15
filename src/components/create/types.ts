import type { ModelCapabilities, ModelPricing } from "@/db/schema";

export type StudioModel = {
  id: string;
  name: string;
  badge: "top" | "new" | null;
  description: string;
  capabilities: ModelCapabilities;
  pricing: ModelPricing;
};

export type JobAsset = {
  id: string;
  url: string;
  posterUrl?: string | null;
  durationMs?: number | null;
  width: number;
  height: number;
  kind: "image" | "video";
  source: "generated" | "rendered" | "sample" | "upload";
  prompt: string | null;
};

export type JobDTO = {
  id: string;
  vertical: "image" | "video";
  status: "queued" | "processing" | "succeeded" | "failed" | "canceled";
  progress: number;
  prompt: string;
  modelId: string;
  modelName: string;
  presetId?: string | null;
  params: { aspect: string; resolution: string; batchSize: number; durationS?: number };
  costTenths: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
  assets: JobAsset[];
};

export const isActive = (j: JobDTO) => j.status === "queued" || j.status === "processing";

export type StudioPreset = {
  id: string;
  name: string;
  category: string;
  description: string;
  featured: boolean;
  preview: { url: string; posterUrl: string | null } | null;
};

export type PickerImage = { id: string; url: string; width: number; height: number; prompt: string | null };
