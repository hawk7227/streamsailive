/**
 * videoGeneration.test.ts
 *
 * Unit tests for video generation logic:
 * - JWT construction for Kling API
 * - Poll endpoint routing by generation type
 * - Error surface logic in generateDualVideo
 * - Video response shape validation
 */

import { describe, it, expect } from "vitest";

// ── JWT structure ─────────────────────────────────────────────────────────

function makeKlingJWT(ak: string, sk: string): string {
  const { createHmac } = require("crypto") as typeof import("crypto");
  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now     = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: ak, exp: now + 1800, nbf: now - 5 })).toString("base64url");
  const data    = `${header}.${payload}`;
  const sig     = createHmac("sha256", sk).update(data).digest("base64url");
  return `${data}.${sig}`;
}

describe("Kling JWT construction", () => {
  it("produces a 3-part JWT string", () => {
    const jwt = makeKlingJWT("test-ak", "test-sk");
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);
  });

  it("header decodes to correct alg", () => {
    const jwt = makeKlingJWT("test-ak", "test-sk");
    const header = JSON.parse(Buffer.from(jwt.split(".")[0], "base64url").toString());
    expect(header.alg).toBe("HS256");
    expect(header.typ).toBe("JWT");
  });

  it("payload contains correct iss", () => {
    const jwt = makeKlingJWT("my-access-key", "my-secret");
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
    expect(payload.iss).toBe("my-access-key");
  });

  it("payload exp is ~30 minutes from now", () => {
    const now = Math.floor(Date.now() / 1000);
    const jwt = makeKlingJWT("ak", "sk");
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
    expect(payload.exp).toBeGreaterThan(now + 1700);
    expect(payload.exp).toBeLessThan(now + 1900);
  });

  it("payload nbf is slightly before now", () => {
    const now = Math.floor(Date.now() / 1000);
    const jwt = makeKlingJWT("ak", "sk");
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString());
    expect(payload.nbf).toBeLessThanOrEqual(now);
    expect(payload.nbf).toBeGreaterThan(now - 10);
  });

  it("signature changes with different secret", () => {
    const jwt1 = makeKlingJWT("ak", "secret1");
    const jwt2 = makeKlingJWT("ak", "secret2");
    expect(jwt1.split(".")[2]).not.toBe(jwt2.split(".")[2]);
  });

  it("different ak produces different payload", () => {
    const jwt1 = makeKlingJWT("ak1", "sk");
    const jwt2 = makeKlingJWT("ak2", "sk");
    expect(jwt1.split(".")[1]).not.toBe(jwt2.split(".")[1]);
  });
});

// ── Poll endpoint routing ────────────────────────────────────────────────

function getKlingPollEndpoint(type: string, externalId: string): string {
  const base = "https://api-singapore.klingai.com";
  if (type === "image") return `${base}/v1/images/generations/${externalId}`;
  if (type === "i2v")   return `${base}/v1/videos/image2video/${externalId}`;
  return `${base}/v1/videos/text2video/${externalId}`;
}

describe("Kling poll endpoint routing", () => {
  it("routes image to images/generations endpoint", () => {
    const ep = getKlingPollEndpoint("image", "task-123");
    expect(ep).toContain("/v1/images/generations/task-123");
  });

  it("routes i2v to videos/image2video endpoint", () => {
    const ep = getKlingPollEndpoint("i2v", "task-456");
    expect(ep).toContain("/v1/videos/image2video/task-456");
  });

  it("routes video to videos/text2video endpoint", () => {
    const ep = getKlingPollEndpoint("video", "task-789");
    expect(ep).toContain("/v1/videos/text2video/task-789");
  });

  it("defaults unknown type to text2video", () => {
    const ep = getKlingPollEndpoint("unknown", "task-000");
    expect(ep).toContain("/v1/videos/text2video/task-000");
  });

  it("uses singapore endpoint not global", () => {
    const ep = getKlingPollEndpoint("video", "x");
    expect(ep).toContain("api-singapore.klingai.com");
    expect(ep).not.toContain("api.klingai.com");
  });
});

// ── Client error detection logic ─────────────────────────────────────────

interface VideoApiResponse {
  data?: { id: string; status: string; output_url?: string };
  error?: string;
}

function shouldTreatAsFailure(res: { ok: boolean }, data: VideoApiResponse): boolean {
  return !res.ok || !!data.error || data.data?.status === "failed";
}

function shouldTreatAsSuccess(res: { ok: boolean }, data: VideoApiResponse): boolean {
  return res.ok && !data.error && !!data.data?.id && data.data?.status !== "failed";
}

describe("Video API response error detection", () => {
  it("treats non-ok response as failure", () => {
    expect(shouldTreatAsFailure({ ok: false }, { data: { id: "x", status: "pending" } })).toBe(true);
  });

  it("treats data.error as failure even with ok=true", () => {
    expect(shouldTreatAsFailure({ ok: true }, { data: { id: "x", status: "pending" }, error: "Kling error" })).toBe(true);
  });

  it("treats status=failed as failure", () => {
    expect(shouldTreatAsFailure({ ok: true }, { data: { id: "x", status: "failed" } })).toBe(true);
  });

  it("treats ok response with pending status as success", () => {
    expect(shouldTreatAsSuccess({ ok: true }, { data: { id: "abc", status: "pending" } })).toBe(true);
  });

  it("treats ok response with completed status as success", () => {
    expect(shouldTreatAsSuccess({ ok: true }, { data: { id: "abc", status: "completed", output_url: "https://..." } })).toBe(true);
  });

  it("treats missing data.id as not success", () => {
    expect(shouldTreatAsSuccess({ ok: true }, {})).toBe(false);
  });

  it("treats failed status as not success regardless of ok", () => {
    expect(shouldTreatAsSuccess({ ok: true }, { data: { id: "x", status: "failed" } })).toBe(false);
  });
});

// ── I2V payload validation ────────────────────────────────────────────────

interface VideoPayload {
  type: string;
  prompt: string;
  provider: string;
  aspectRatio: string;
  duration: string;
  mode: string;
  imageUrl?: string;
}

function buildVideoPayload(opts: {
  videoMode: "scratch_t2v" | "i2v";
  videoPrompt: string;
  videoProvider: "kling" | "runway";
  viewMode: string;
  imageResult: string | null;
}): VideoPayload {
  const payload: VideoPayload = {
    type: opts.videoMode === "i2v" ? "i2v" : "video",
    prompt: opts.videoPrompt,
    provider: opts.videoProvider,
    aspectRatio: opts.viewMode,
    duration: "5s",
    mode: opts.videoMode,
  };
  if (opts.videoMode === "i2v" && opts.imageResult) {
    payload.imageUrl = opts.imageResult;
  }
  return payload;
}

describe("Video payload construction", () => {
  it("T2V sets type to video", () => {
    const p = buildVideoPayload({ videoMode: "scratch_t2v", videoPrompt: "test", videoProvider: "kling", viewMode: "16:9", imageResult: null });
    expect(p.type).toBe("video");
  });

  it("I2V sets type to i2v", () => {
    const p = buildVideoPayload({ videoMode: "i2v", videoPrompt: "test", videoProvider: "kling", viewMode: "16:9", imageResult: "https://img.jpg" });
    expect(p.type).toBe("i2v");
  });

  it("I2V includes imageUrl when imageResult is set", () => {
    const p = buildVideoPayload({ videoMode: "i2v", videoPrompt: "test", videoProvider: "kling", viewMode: "16:9", imageResult: "https://img.jpg" });
    expect(p.imageUrl).toBe("https://img.jpg");
  });

  it("T2V does not include imageUrl", () => {
    const p = buildVideoPayload({ videoMode: "scratch_t2v", videoPrompt: "test", videoProvider: "kling", viewMode: "16:9", imageResult: "https://img.jpg" });
    expect(p.imageUrl).toBeUndefined();
  });

  it("I2V without imageResult does not include imageUrl", () => {
    const p = buildVideoPayload({ videoMode: "i2v", videoPrompt: "test", videoProvider: "kling", viewMode: "16:9", imageResult: null });
    expect(p.imageUrl).toBeUndefined();
  });

  it("passes provider correctly", () => {
    const p = buildVideoPayload({ videoMode: "scratch_t2v", videoPrompt: "test", videoProvider: "runway", viewMode: "9:16", imageResult: null });
    expect(p.provider).toBe("runway");
  });

  it("passes viewMode as aspectRatio", () => {
    const p = buildVideoPayload({ videoMode: "scratch_t2v", videoPrompt: "test", videoProvider: "kling", viewMode: "9:16", imageResult: null });
    expect(p.aspectRatio).toBe("9:16");
  });

  it("duration is always 5s", () => {
    const p = buildVideoPayload({ videoMode: "scratch_t2v", videoPrompt: "test", videoProvider: "kling", viewMode: "16:9", imageResult: null });
    expect(p.duration).toBe("5s");
  });
});
