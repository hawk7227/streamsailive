import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as cheerio from "cheerio";

type IntakeType = "url" | "image" | "video" | "doc" | "audio";

type AnalysisResult = {
  analysisResult: string;
  suggestedStrategy: string;
  suggestedImagePrompt: string;
  suggestedVideoDirection: string;
  detectedStyle: string;
  sourceType: IntakeType;
};

async function extractTextFromUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { "User-Agent": "StreamsAI/1.0 (content analysis)" },
  });
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.statusText}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove script/style/nav/footer noise
  $("script, style, nav, footer, header, [aria-hidden='true']").remove();

  const title = $("title").text().trim();
  const metaDesc = $("meta[name='description']").attr("content") ?? "";
  const h1s = $("h1").map((_, el) => $(el).text().trim()).get().slice(0, 3).join(" | ");
  const h2s = $("h2").map((_, el) => $(el).text().trim()).get().slice(0, 5).join(" | ");
  const bodyText = $("main, article, section, [role='main']").first().text()
    .replace(/\s+/g, " ").trim().slice(0, 2000);
  const ctaText = $("a, button").map((_, el) => $(el).text().trim()).get()
    .filter(t => t.length > 2 && t.length < 50).slice(0, 10).join(" | ");

  return [
    title ? `Title: ${title}` : "",
    metaDesc ? `Meta: ${metaDesc}` : "",
    h1s ? `H1: ${h1s}` : "",
    h2s ? `H2: ${h2s}` : "",
    bodyText ? `Body: ${bodyText}` : "",
    ctaText ? `CTAs: ${ctaText}` : "",
  ].filter(Boolean).join("\n");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, url, fileUrl, nicheContext } = body as {
    type?: IntakeType;
    url?: string;
    fileUrl?: string;
    nicheContext?: string;
  };

  if (!type) return NextResponse.json({ error: "type is required" }, { status: 400 });
  if (type === "url" && !url) return NextResponse.json({ error: "url is required for type=url" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OpenAI not configured" }, { status: 500 });

  // Extract source content
  let sourceContent = "";
  try {
    if (type === "url" && url) {
      sourceContent = await extractTextFromUrl(url);
    } else if (fileUrl) {
      // For file types: fetch the public URL content if text-based
      const res = await fetch(fileUrl, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("text") || ct.includes("json")) {
          sourceContent = (await res.text()).slice(0, 3000);
        } else {
          sourceContent = `[Binary file: ${ct}]`;
        }
      }
    }
  } catch (err) {
    // Non-fatal — AI can still attempt analysis with partial info
    sourceContent = `[Could not fully extract content: ${err instanceof Error ? err.message : "unknown error"}]`;
  }

  const systemPrompt = `You are a creative director and strategist specialising in healthcare/telehealth brand content.

Analyse the provided source content and return ONLY a valid JSON object (no markdown, no backticks) with this exact shape:
{
  "analysisResult": "2-3 sentence summary of the brand, tone, and key messaging found",
  "suggestedStrategy": "1-2 sentence strategic direction for ad creation",
  "suggestedImagePrompt": "A realistic, unpolished description of a real person using telehealth at home (under 50 words). No premium, cinematic, or lifestyle language.",
  "suggestedVideoDirection": "Motion direction for image-to-video (under 40 words, motion only)",
  "detectedStyle": "one of: premium-healthcare, clinical, warm-modern, minimal, bold, generic",
  "sourceType": "${type}"
}

${nicheContext ? `Active governance rules: ${nicheContext}` : ""}

All output must be safe for telehealth advertising: no medical claims, no guaranteed outcomes, no diagnostic language.`;

  const userMessage = sourceContent
    ? `Analyse this source content:\n\n${sourceContent}`
    : `Analyse this ${type} intake. No extractable content was available — provide realistic, ordinary healthcare direction. Avoid premium or cinematic language.`;

  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.4,
      max_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!aiRes.ok) {
    const err = await aiRes.text();
    return NextResponse.json({ error: `OpenAI error: ${err}` }, { status: 502 });
  }

  const aiData = await aiRes.json() as { choices: { message: { content: string } }[] };
  const raw = aiData.choices?.[0]?.message?.content ?? "";

  let parsed: AnalysisResult;
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(clean) as AnalysisResult;
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response", raw }, { status: 500 });
  }

  return NextResponse.json({ data: parsed });
}
