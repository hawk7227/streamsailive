/**
 * POST /api/intake/website
 *
 * Deep website analysis: reads HTML/CSS structure, extracts design tokens,
 * brand colors, typography, layout patterns, and copy.
 * Returns: brand analysis, design tokens, layout structure, and creative direction.
 *
 * No screenshot API required — uses cheerio for DOM analysis.
 * For visual duplication: extracts color palette, font stack, spacing system,
 * and section layout from inline styles + computed CSS classes.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as cheerio from "cheerio";

export const maxDuration = 60;

interface DesignTokens {
  colors: string[];
  fonts: string[];
  buttonStyles: string[];
  layoutSections: string[];
  headings: string[];
  ctaTexts: string[];
  navigationItems: string[];
  heroContent: { headline: string; subtext: string; cta: string } | null;
}

function extractDesignTokens(html: string, baseUrl: string): DesignTokens {
  const $ = cheerio.load(html);

  // Extract colors from inline styles and style tags
  const colorRegex = /#[0-9a-fA-F]{3,8}\b|rgb\([^)]+\)|hsl\([^)]+\)/g;
  const allStyles = $("[style]").map((_, el) => $(el).attr("style") ?? "").get().join(" ");
  const styleTagContent = $("style").map((_, el) => $(el).text()).get().join(" ");
  const colorMatches = [...new Set([
    ...(allStyles.match(colorRegex) ?? []),
    ...(styleTagContent.match(colorRegex) ?? []),
  ])].slice(0, 12);

  // Extract font families
  const fontRegex = /font-family:\s*([^;}"]+)/gi;
  const fontMatches = [...new Set([
    ...(styleTagContent.match(fontRegex) ?? []),
    ...(allStyles.match(fontRegex) ?? []),
  ])].map(f => f.replace(/font-family:\s*/i, "").replace(/['"]/g, "").trim()).slice(0, 5);

  // Extract navigation
  const navItems = $("nav a, header a").map((_, el) => $(el).text().trim()).get()
    .filter(t => t.length > 1 && t.length < 30).slice(0, 8);

  // Extract CTAs
  const ctaTexts = $("button, a.btn, a.cta, [class*='btn'], [class*='cta'], [class*='button']")
    .map((_, el) => $(el).text().trim()).get()
    .filter(t => t.length > 1 && t.length < 50)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 8);

  // Extract headings
  const headings = $("h1, h2, h3").map((_, el) => $(el).text().trim()).get()
    .filter(t => t.length > 2).slice(0, 10);

  // Extract layout sections
  const sections = $("section, [class*='section'], [class*='hero'], [class*='feature'], [class*='pricing'], [id*='section']")
    .map((_, el) => $(el).attr("class") ?? $(el).attr("id") ?? "").get()
    .filter(Boolean).slice(0, 10);

  // Hero content
  const heroEl = $("[class*='hero'], [id*='hero'], header").first();
  const heroHeadline = heroEl.find("h1").first().text().trim() || $("h1").first().text().trim();
  const heroSubtext = heroEl.find("p").first().text().trim().slice(0, 120);
  const heroCta = heroEl.find("button, a.btn, [class*='btn']").first().text().trim();

  // Button styles
  const btnStyles = $("button, [class*='btn']").map((_, el) => {
    const s = $(el).attr("style") ?? "";
    const c = $(el).attr("class") ?? "";
    return (s + " " + c).trim();
  }).get().filter(Boolean).slice(0, 4);

  return {
    colors: colorMatches,
    fonts: fontMatches,
    buttonStyles: btnStyles,
    layoutSections: sections,
    headings,
    ctaTexts,
    navigationItems: navItems,
    heroContent: heroHeadline ? { headline: heroHeadline, subtext: heroSubtext, cta: heroCta } : null,
  };
}

async function fetchWebsite(url: string): Promise<{ html: string; finalUrl: string; title: string; metaDesc: string }> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; StreamsAI/1.0; +https://streamsai.com)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) throw new Error(`URL returned non-HTML content: ${contentType}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  return {
    html,
    finalUrl: res.url,
    title: $("title").text().trim(),
    metaDesc: $("meta[name='description']").attr("content") ?? $("meta[property='og:description']").attr("content") ?? "",
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });

  let body: { url?: string };
  try { body = await req.json() as { url?: string }; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { url } = body;
  if (!url?.trim()) return NextResponse.json({ error: "url is required" }, { status: 400 });

  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http")) normalizedUrl = "https://" + normalizedUrl;

  let siteData: Awaited<ReturnType<typeof fetchWebsite>>;
  try {
    siteData = await fetchWebsite(normalizedUrl);
  } catch (err) {
    return NextResponse.json({ error: `Could not fetch website: ${err instanceof Error ? err.message : String(err)}` }, { status: 400 });
  }

  const tokens = extractDesignTokens(siteData.html, normalizedUrl);

  // Build content summary for GPT-4o
  const $ = cheerio.load(siteData.html);
  $("script, style, nav, footer, [aria-hidden='true'], svg").remove();
  const bodyText = $("main, article, section, [role='main'], body").first().text()
    .replace(/\s+/g, " ").trim().slice(0, 2500);

  const contentSummary = [
    `URL: ${siteData.finalUrl}`,
    `Title: ${siteData.title}`,
    siteData.metaDesc ? `Meta: ${siteData.metaDesc}` : "",
    tokens.heroContent ? `Hero headline: ${tokens.heroContent.headline}` : "",
    tokens.heroContent?.subtext ? `Hero subtext: ${tokens.heroContent.subtext}` : "",
    tokens.ctaTexts.length ? `CTAs found: ${tokens.ctaTexts.join(", ")}` : "",
    tokens.headings.length ? `Headings: ${tokens.headings.slice(0, 5).join(" | ")}` : "",
    tokens.navigationItems.length ? `Nav items: ${tokens.navigationItems.join(", ")}` : "",
    `Colors detected: ${tokens.colors.slice(0, 6).join(", ") || "none"}`,
    `Fonts detected: ${tokens.fonts.join(", ") || "none"}`,
    `Layout sections: ${tokens.layoutSections.slice(0, 6).join(", ") || "standard"}`,
    bodyText ? `Page content: ${bodyText.slice(0, 1500)}` : "",
  ].filter(Boolean).join("\n");

  // GPT-4o deep analysis
  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content: `You are a senior brand strategist and creative director. Analyze websites for their brand identity, design language, and creative direction.
Return ONLY valid JSON (no markdown, no backticks):
{
  "brandName": "detected brand name",
  "analysisResult": "3-4 sentences: brand positioning, tone, audience, what makes this brand distinctive",
  "detectedStyle": "one word: premium | clinical | warm | minimal | bold | playful | corporate | modern",
  "colorPalette": { "primary": "#hex or description", "secondary": "#hex or description", "accent": "#hex or description", "background": "#hex or description", "text": "#hex or description" },
  "typographyStyle": "e.g. sans-serif clean, serif editorial, mixed modern",
  "layoutPattern": "e.g. hero-features-testimonials-cta, split-screen, card-grid, minimal-centered",
  "toneOfVoice": "2-3 words describing the brand voice",
  "targetAudience": "who this brand targets",
  "keyMessages": ["message 1", "message 2", "message 3"],
  "suggestedImagePrompt": "Under 60 words. A real, unpolished photo inspired by this brand's style. No cinematic language.",
  "suggestedVideoDirection": "Under 40 words. Motion direction for a 5s clip in this brand's style.",
  "duplicateLayoutSuggestion": "How to recreate this layout structure: section order, key components, spacing notes",
  "suggestedCopy": { "headline": "headline in this brand's voice, under 8 words", "subheadline": "under 15 words", "cta": "under 4 words" }
}`,
        },
        { role: "user", content: `Analyze this website:\n\n${contentSummary}` },
      ],
    }),
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    return NextResponse.json({ error: `Analysis failed: ${err}` }, { status: 500 });
  }

  const aiData = await aiRes.json() as { choices: Array<{ message: { content: string } }> };
  const raw = aiData.choices[0]?.message?.content ?? "{}";
  const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  let analysis: Record<string, unknown>;
  try { analysis = JSON.parse(clean) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "AI returned invalid JSON", raw }, { status: 500 }); }

  return NextResponse.json({
    ok: true,
    url: siteData.finalUrl,
    title: siteData.title,
    designTokens: tokens,
    ...analysis,
  });
}
