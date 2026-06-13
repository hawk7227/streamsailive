import "server-only";

import { getCapabilityReadiness, type CapabilityId } from "./env-readiness";

export class ProviderAccessError extends Error {
  capabilityId: CapabilityId;
  missing: string[];

  constructor(capabilityId: CapabilityId, missing: string[]) {
    super(`Capability ${capabilityId} is not ready`);
    this.name = "ProviderAccessError";
    this.capabilityId = capabilityId;
    this.missing = missing;
  }
}

export function assertCapabilityReady(capabilityId: CapabilityId): void {
  const readiness = getCapabilityReadiness(capabilityId);
  if (readiness.state === "missing") {
    throw new ProviderAccessError(capabilityId, readiness.missing);
  }
}

export function getServerEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export function getOptionalServerEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value;
  }
  return "";
}

export function getOpenAIImageAccess() {
  assertCapabilityReady("gen-text-to-image-openai");
  return {
    apiKey: getOptionalServerEnv("OPENAI_API_KEY_IMAGES", "OPENAI_API_KEY"),
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
  };
}

export function getFalAccess() {
  assertCapabilityReady("gen-text-to-image-fal");
  return {
    apiKey: getOptionalServerEnv("FAL_API_KEY", "FAL_KEY"),
  };
}

export function getRunwayAccess() {
  assertCapabilityReady("gen-image-to-video-runway");
  return {
    apiKey: getServerEnv("RUNWAY_API_KEY"),
    endpoint: getOptionalServerEnv("RUNWAY_GENERATION_ENDPOINT", "RUNWAY_EDIT_ENDPOINT"),
    version: process.env.RUNWAY_API_VERSION || "",
  };
}

export function getKlingAccess() {
  assertCapabilityReady("gen-image-to-video-kling");
  return {
    apiKey: getServerEnv("KLING_API_KEY"),
    endpoint: getOptionalServerEnv("KLING_GENERATION_ENDPOINT", "KLING_EDIT_ENDPOINT"),
    assessApiKey: process.env.KLING_ASSESS_API_KEY || "",
  };
}

export function getVeoAccess() {
  assertCapabilityReady("gen-image-to-video-veo");
  return {
    apiKey: getServerEnv("VEO_API_KEY"),
    endpoint: getOptionalServerEnv("VEO_GENERATION_ENDPOINT", "VEO_EDIT_ENDPOINT"),
  };
}

export function getElevenLabsAccess() {
  assertCapabilityReady("gen-voice-elevenlabs");
  return {
    apiKey: getServerEnv("ELEVENLABS_API_KEY"),
  };
}

export function getGitHubAccess() {
  assertCapabilityReady("builder-github");
  return {
    token: getOptionalServerEnv("GITHUB_TOKEN", "GH_TOKEN"),
    clientId: getServerEnv("GITHUB_CLIENT_ID"),
    clientSecret: getServerEnv("GITHUB_CLIENT_SECRET"),
    callbackUrl: getServerEnv("GITHUB_CALLBACK_URL"),
  };
}

export function getVercelAccess() {
  assertCapabilityReady("builder-vercel");
  return {
    token: getServerEnv("VERCEL_TOKEN"),
  };
}
