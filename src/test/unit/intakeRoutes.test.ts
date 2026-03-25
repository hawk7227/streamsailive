/**
 * intakeRoutes.test.ts
 *
 * Unit tests for intake, ideas, and generate-image routes.
 * Tests logic that doesn't require API keys or network.
 */

import { describe, it, expect } from "vitest";

// ── YouTube URL extraction ────────────────────────────────────────────────

function extractVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

describe("YouTube URL extraction", () => {
  it("extracts from standard watch URL", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from short youtu.be URL", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from shorts URL", () => {
    expect(extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from embed URL", () => {
    expect(extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("handles URL with extra params", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=PL123")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube URL", () => {
    expect(extractVideoId("https://example.com/video")).toBeNull();
  });

  it("returns null for malformed YouTube URL", () => {
    expect(extractVideoId("https://youtube.com")).toBeNull();
  });
});

// ── YouTube detection ─────────────────────────────────────────────────────

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts/i.test(url);
}

describe("YouTube URL detection", () => {
  it("detects youtube.com/watch", () => expect(isYouTubeUrl("https://youtube.com/watch?v=abc")).toBe(true));
  it("detects youtu.be shortlink", () => expect(isYouTubeUrl("https://youtu.be/abc")).toBe(true));
  it("detects youtube shorts", () => expect(isYouTubeUrl("https://youtube.com/shorts/abc")).toBe(true));
  it("does not match plain website", () => expect(isYouTubeUrl("https://example.com")).toBe(false));
  it("does not match vimeo", () => expect(isYouTubeUrl("https://vimeo.com/123456")).toBe(false));
});

// ── Image prompt sanitizer ────────────────────────────────────────────────

const FORBIDDEN_IMAGE_TERMS = [
  "cinematic", "dramatic lighting", "movie still", "film still", "editorial",
  "fashion photography", "beauty campaign", "luxury", "premium look", "masterpiece",
  "8k", "hyper-detailed", "award-winning", "glossy", "studio lighting",
  "shallow depth of field", "bokeh", "text overlay", "ui overlay",
];

function sanitizeImagePrompt(raw: string): { sanitized: string; stripped: string[] } {
  const stripped: string[] = [];
  let result = raw;
  for (const term of FORBIDDEN_IMAGE_TERMS) {
    const regex = new RegExp(`(?:^|\\b)${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\b|$)`, "gi");
    if (regex.test(result)) {
      stripped.push(term);
      result = result.replace(new RegExp(`(?:^|\\b)${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\b|$)`, "gi"), " ").trim();
    }
  }
  result = result.replace(/\s{2,}/g, " ").trim();
  return { sanitized: result, stripped };
}

describe("Image prompt sanitizer", () => {
  it("strips cinematic from prompt", () => {
    const r = sanitizeImagePrompt("A cinematic shot of a woman");
    expect(r.stripped).toContain("cinematic");
    expect(r.sanitized).not.toMatch(/\bcinematic\b/i);
  });

  it("strips bokeh", () => {
    const r = sanitizeImagePrompt("portrait with bokeh background");
    expect(r.stripped).toContain("bokeh");
  });

  it("strips studio lighting", () => {
    const r = sanitizeImagePrompt("studio lighting setup");
    expect(r.stripped).toContain("studio lighting");
  });

  it("strips luxury", () => {
    const r = sanitizeImagePrompt("luxury lifestyle shot");
    expect(r.stripped).toContain("luxury");
  });

  it("strips 8k", () => {
    const r = sanitizeImagePrompt("ultra detailed 8k render");
    expect(r.stripped).toContain("8k");
  });

  it("preserves ordinary content", () => {
    const r = sanitizeImagePrompt("A person at a kitchen table with a coffee mug");
    expect(r.stripped).toHaveLength(0);
    expect(r.sanitized).toContain("kitchen table");
  });

  it("returns empty stripped array for clean prompt", () => {
    const r = sanitizeImagePrompt("Person sitting in an office chair, natural light");
    expect(r.stripped).toHaveLength(0);
  });

  it("handles multiple terms in one prompt", () => {
    const r = sanitizeImagePrompt("cinematic bokeh luxury studio lighting masterpiece");
    expect(r.stripped.length).toBeGreaterThanOrEqual(4);
  });
});

// ── Website URL normalization ─────────────────────────────────────────────

function normalizeUrl(url: string): string {
  if (!url.startsWith("http")) return "https://" + url;
  return url;
}

describe("Website URL normalization", () => {
  it("adds https to bare domain", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
  });

  it("preserves existing https", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("preserves existing http", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("handles www prefix", () => {
    expect(normalizeUrl("www.example.com")).toBe("https://www.example.com");
  });
});

// ── Design token extraction (color regex) ────────────────────────────────

const colorRegex = /#[0-9a-fA-F]{3,8}\b|rgb\([^)]+\)|hsl\([^)]+\)/g;

describe("Design token color extraction", () => {
  it("extracts hex colors", () => {
    const css = "color: #ff6600; background: #fff;";
    const colors = css.match(colorRegex) ?? [];
    expect(colors).toContain("#ff6600");
    expect(colors).toContain("#fff");
  });

  it("extracts rgb colors", () => {
    const css = "color: rgb(255, 100, 0);";
    const colors = css.match(colorRegex) ?? [];
    expect(colors.some(c => c.includes("rgb"))).toBe(true);
  });

  it("extracts 8-char hex with alpha", () => {
    const css = "background: #ff660088;";
    const colors = css.match(colorRegex) ?? [];
    expect(colors).toContain("#ff660088");
  });

  it("returns empty array when no colors", () => {
    const css = "font-size: 14px; margin: 0;";
    expect(css.match(colorRegex) ?? []).toHaveLength(0);
  });
});

// ── Reference classification ──────────────────────────────────────────────

type RefClassification = "usable" | "risky" | "reject";

function classifyRef(name: string): RefClassification {
  const lower = name.toLowerCase();
  // Reject: explicit UI/text tokens as query params or filename patterns
  if (/text=|overlay=|caption=|ui=|_overlay\.|_caption\.|_ui\./i.test(lower)) return "reject";
  if (/cinematic|studio|glossy|polished|luxury|premium|hdr/i.test(lower)) return "risky";
  return "usable";
}

describe("Reference classification", () => {
  it("rejects files with UI/text tokens in name", () => {
    expect(classifyRef("image_overlay.png")).toBe("reject");   // _overlay.
    expect(classifyRef("text=headline.jpg")).toBe("reject");   // text=
    expect(classifyRef("file_caption.png")).toBe("reject");    // _caption.
  });

  it("flags cinematic/glossy refs as risky", () => {
    expect(classifyRef("cinematic_shot.jpg")).toBe("risky");
    expect(classifyRef("studio_product_photo.jpg")).toBe("risky");
    expect(classifyRef("luxury_lifestyle.png")).toBe("risky");
  });

  it("marks ordinary refs as usable", () => {
    expect(classifyRef("living_room_photo.jpg")).toBe("usable");
    expect(classifyRef("person_at_desk.png")).toBe("usable");
    expect(classifyRef("ref1.jpg")).toBe("usable");
  });

  it("is case insensitive", () => {
    expect(classifyRef("CINEMATIC_shot.jpg")).toBe("risky");
    expect(classifyRef("OVERLAY=true.png")).toBe("reject");
  });
});

// ── Idea JSON parsing ─────────────────────────────────────────────────────

function safeParseIdeas(text: string): string[] {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as string[];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

describe("Idea JSON parsing", () => {
  it("parses clean JSON array", () => {
    const result = safeParseIdeas('["idea 1", "idea 2", "idea 3"]');
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("idea 1");
  });

  it("strips markdown fences before parsing", () => {
    const result = safeParseIdeas('```json\n["idea 1", "idea 2"]\n```');
    expect(result).toHaveLength(2);
  });

  it("limits to 6 ideas", () => {
    const ideas = JSON.stringify(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(safeParseIdeas(ideas)).toHaveLength(6);
  });

  it("returns empty array on invalid JSON", () => {
    expect(safeParseIdeas("not json")).toHaveLength(0);
  });

  it("returns empty array on non-array JSON", () => {
    expect(safeParseIdeas('{"ideas": ["a", "b"]}')).toHaveLength(0);
  });
});
