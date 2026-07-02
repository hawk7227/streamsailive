/**
 * POST /api/streams/generate-job
 *
 * Create generation job(s) and return immediately (non-blocking).
 * Supports normal single prompts and separated multi-clip scripts.
 *
 * Multi-clip script format supported:
 * GLOBAL SETUP:
 * shared scene/character/camera/lighting setup
 *
 * SET A: street exterior, same car, same night lighting
 * CLIP 1: ...
 * CLIP 2: ...
 *
 * SET B: new interior location
 * CLIP 3: ...
 *
 * Each clip is submitted as a separate job, but every prompt is wrapped with
 * the shared setup and current set setup so provider calls do not drift.
 */

import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, key);
}

type ParsedClip = {
  index: number;
  prompt: string;
  setId: string;
  setSetup: string;
};

type ParsedBatch = {
  isBatch: boolean;
  globalSetup: string;
  clips: ParsedClip[];
};

function isVideoMode(mode: string) {
  return mode === "T2V" || mode === "I2V" || mode === "Motion";
}

function normalizeLine(line: string) {
  return line.replace(/^[-*\s]+/, "").trim();
}

function parseSeparatedClipScript(rawPrompt: string): ParsedBatch {
  const lines = String(rawPrompt || "").split(/\r?\n/);
  const clips: ParsedClip[] = [];
  const globalLines: string[] = [];
  let currentSetId = "default";
  let currentSetSetup = "";
  let activeClip: ParsedClip | null = null;
  let seenClip = false;
  let inGlobal = false;

  function pushActiveClip() {
    if (activeClip?.prompt.trim()) {
      clips.push({
        ...activeClip,
        prompt: activeClip.prompt.trim(),
      });
    }
  }

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine);
    if (!line) {
      if (activeClip) activeClip.prompt += "\n";
      continue;
    }

    const globalMatch = line.match(/^GLOBAL\s+(SETUP|SCENE|BIBLE)\s*:\s*(.*)$/i);
    if (globalMatch) {
      inGlobal = true;
      seenClip = false;
      if (globalMatch[2]) globalLines.push(globalMatch[2].trim());
      continue;
    }

    const setMatch = line.match(/^SET\s*([A-Z0-9_-]+)?\s*:\s*(.*)$/i);
    if (setMatch) {
      pushActiveClip();
      activeClip = null;
      inGlobal = false;
      currentSetId = setMatch[1]?.trim() || `set-${clips.length + 1}`;
      currentSetSetup = setMatch[2]?.trim() || "";
      continue;
    }

    const clipMatch = line.match(/^(CLIP|SCENE)\s*(\d+)?\s*:\s*(.*)$/i);
    if (clipMatch) {
      pushActiveClip();
      inGlobal = false;
      seenClip = true;
      activeClip = {
        index: Number(clipMatch[2] || clips.length + 1),
        prompt: clipMatch[3]?.trim() || "",
        setId: currentSetId,
        setSetup: currentSetSetup,
      };
      continue;
    }

    if (activeClip) {
      activeClip.prompt += activeClip.prompt ? `\n${line}` : line;
    } else if (inGlobal || !seenClip) {
      globalLines.push(line);
    } else if (currentSetSetup) {
      currentSetSetup += ` ${line}`;
    }
  }

  pushActiveClip();

  return {
    isBatch: clips.length > 1,
    globalSetup: globalLines.join("\n").trim(),
    clips,
  };
}

function buildContinuityPrompt(args: {
  globalSetup: string;
  clip: ParsedClip;
  previous?: ParsedClip;
  next?: ParsedClip;
}) {
  const parts = [
    "LONG VIDEO CONTINUITY LOCK. This clip is one separate provider entry inside a larger video. Obey the shared setup exactly.",
    args.globalSetup ? `GLOBAL SETUP:\n${args.globalSetup}` : "GLOBAL SETUP: Preserve the same subject identity, wardrobe, camera style, color palette, lighting direction, time of day, and environment unless the current set changes.",
    `SET CONTINUITY ID: ${args.clip.setId}. Keep the same set for every clip with this set ID. Do not redesign the room, street, car, props, wardrobe, lighting, or camera language inside the same set.`,
    args.clip.setSetup ? `CURRENT SET SETUP:\n${args.clip.setSetup}` : undefined,
    args.previous ? `PREVIOUS CLIP HANDOFF:\nClip ${args.previous.index}: ${args.previous.prompt.slice(0, 220)}` : undefined,
    `CURRENT CLIP ${args.clip.index}:\n${args.clip.prompt}`,
    args.next ? `NEXT CLIP HANDOFF:\nClip ${args.next.index}: ${args.next.prompt.slice(0, 220)}` : undefined,
    [
      "RULES:",
      "- Treat this as the next shot from the same film, not a new unrelated video.",
      "- Keep identity, wardrobe, location, prop positions, lens feel, lighting, scale, and movement consistent.",
      "- Only change the screen/set/environment when CURRENT SET SETUP or SET CONTINUITY ID changes.",
      "- Avoid scene drift, environment drift, identity drift, wardrobe drift, random new props, and time-of-day mismatch.",
    ].join("\n"),
  ];

  return parts.filter(Boolean).join("\n\n");
}

function getEstimatedDuration(mode: string) {
  if (mode === "Image") return 8;
  if (mode === "T2V" || mode === "I2V" || mode === "Motion") return 45;
  if (mode === "Voice") return 10;
  if (mode === "Music") return 20;
  return 30;
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const {
      mode,
      prompt,
      model,
      duration,
      aspectRatio,
      customWidth,
      customHeight,
      bulkJobId,
      userId,
      workspaceId,
    } = body;

    if (!mode || !prompt || !model || !userId || !workspaceId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const estimatedDuration = getEstimatedDuration(mode);
    const parsedBatch = isVideoMode(mode) ? parseSeparatedClipScript(prompt) : { isBatch: false, globalSetup: "", clips: [] };

    if (parsedBatch.isBatch) {
      const batchId = bulkJobId || `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const provider = getProviderForModel(model);
      const rows = parsedBatch.clips.map((clip, index) => {
        const generationId = `gen_${Date.now()}_${clip.index}_${Math.random().toString(36).slice(2, 9)}`;
        return {
          mode,
          status: "queued",
          prompt: buildContinuityPrompt({
            globalSetup: parsedBatch.globalSetup,
            clip,
            previous: parsedBatch.clips[index - 1],
            next: parsedBatch.clips[index + 1],
          }),
          model,
          duration,
          aspect_ratio: aspectRatio,
          custom_width: customWidth,
          custom_height: customHeight,
          generation_id: generationId,
          provider,
          user_id: userId,
          workspace_id: workspaceId,
          bulk_job_id: batchId,
          retry_count: 0,
          created_at: new Date().toISOString(),
        };
      });

      const { data: jobs, error } = await supabase
        .from("generation_jobs")
        .insert(rows)
        .select();

      if (error) {
        console.error("Database error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to create batch jobs" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          jobId: jobs?.[0]?.id,
          generationId: batchId,
          bulkJobId: batchId,
          batch: true,
          sceneCount: rows.length,
          jobs: (jobs || []).map((job: { id: string; generation_id?: string; prompt?: string }) => ({
            id: job.id,
            generationId: job.generation_id,
          })),
          estimatedDuration,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    }

    const generationId = `gen_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const { data: job, error } = await supabase
      .from("generation_jobs")
      .insert([
        {
          mode,
          status: "queued",
          prompt,
          model,
          duration,
          aspect_ratio: aspectRatio,
          custom_width: customWidth,
          custom_height: customHeight,
          generation_id: generationId,
          provider: getProviderForModel(model),
          user_id: userId,
          workspace_id: workspaceId,
          bulk_job_id: bulkJobId,
          retry_count: 0,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create job" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        jobId: job.id,
        generationId,
        estimatedDuration,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating generation job:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Helper: Get provider name from model
 */
function getProviderForModel(model: string): string {
  if (model.includes("kling") || model.includes("Kling")) return "kling";
  if (model.includes("veo") || model.includes("Veo")) return "veo";
  if (model.includes("flux") || model.includes("FLUX")) return "flux";
  if (model.includes("minimax") || model.includes("Minimax")) return "minimax";
  if (model.includes("elevenlabs") || model.includes("ElevenLabs")) return "elevenlabs";
  return "unknown";
}
