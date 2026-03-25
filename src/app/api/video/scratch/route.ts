/**
 * /api/video/scratch
 *
 * Production T2V scratch video endpoint.
 * Per spec: sanitize → expand → generate 4 candidates →
 * poll → QC score each → reject failures →
 * select best → post-process → store → return.
 * Rejection loop: up to 3 rounds.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { buildT2VPrompt } from "@/lib/media-realism-video/t2vPromptBuilder";
import { submitT2VCandidates, pollT2VCandidate } from "@/lib/media-realism-video/generationClient";
import { scoreT2VCandidate, shouldRejectT2VCandidate } from "@/lib/media-realism-video/t2vQc";
import { selectBestT2VCandidate } from "@/lib/media-realism-video/t2vSelector";
import { postProcessT2V } from "@/lib/media-realism-video/t2vPostProcess";
import { createAdminClient as createAdmin2 } from "@/lib/supabase/admin";
import type { T2VInput, T2VCandidate, T2VQcScore, T2VResult } from "@/lib/media-realism-video/types";

export const maxDuration = 300;

const MAX_ROUNDS = 3;
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 240000;

type ScoredCandidate = { candidate: T2VCandidate; score: T2VQcScore };

async function getWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const selection = await getCurrentWorkspaceSelection(admin, user);
  return { user, workspace: selection.current.workspace, admin };
}

async function pollUntilComplete(candidates: T2VCandidate[]): Promise<T2VCandidate[]> {
  const resolved = new Map<string, T2VCandidate>(candidates.map(c => [c.id, c]));
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const pending = Array.from(resolved.values()).filter(c => c.status === "pending" || c.status === "processing");
    if (pending.length === 0) break;
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    for (const candidate of pending) {
      try {
        const updated = await pollT2VCandidate(candidate);
        resolved.set(candidate.id, updated);
      } catch { /* leave as processing */ }
    }
  }
  return Array.from(resolved.values());
}

async function uploadVideoUrl(remoteUrl: string, workspaceId: string): Promise<string> {
  const res = await fetch(remoteUrl, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Video download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const admin = createAdminClient();
  const storagePath = `${workspaceId}/t2v_${crypto.randomUUID()}.mp4`;
  const { error } = await admin.storage.from("generations").upload(storagePath, buffer, { contentType: "video/mp4", upsert: false });
  if (error) throw new Error(`Storage upload: ${error.message}`);
  const { data } = admin.storage.from("generations").getPublicUrl(storagePath);
  return data.publicUrl;
}

async function runRound(input: T2VInput, roundNum: number): Promise<{ allScored: ScoredCandidate[]; accepted: boolean; bestUrl?: string; bestScore?: T2VQcScore }> {
  const expanded = buildT2VPrompt(input);
  console.log(`[T2V] Round ${roundNum}: submitting 4 candidates. Stripped: ${expanded.sanitized.strippedTerms.join(", ") || "none"}`);
  const candidates = await submitT2VCandidates(expanded, input, 4);
  const resolved = await pollUntilComplete(candidates);
  const completed = resolved.filter(c => c.status === "completed" && c.videoUrl);
  if (completed.length === 0) return { allScored: [], accepted: false };
  const scored: ScoredCandidate[] = completed.map(candidate => ({ candidate, score: scoreT2VCandidate(candidate.videoUrl!) }));
  const selection = selectBestT2VCandidate(scored);
  if (!selection.accepted || !selection.acceptedCandidate?.videoUrl) return { allScored: scored, accepted: false };
  return { allScored: scored, accepted: true, bestUrl: selection.acceptedCandidate.videoUrl, bestScore: selection.acceptedScore };
}

export async function POST(request: NextRequest) {
  const ctx = await getWorkspace();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspace, admin } = ctx;

  let body: Partial<T2VInput>;
  try { body = await request.json() as Partial<T2VInput>; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.prompt?.trim()) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  const input: T2VInput = {
    prompt: body.prompt.trim(),
    aspectRatio: body.aspectRatio ?? "16:9",
    duration: body.duration ?? "5",
    quality: body.quality ?? "1080p",
    realismMode: body.realismMode ?? "human_lifestyle",
    workspaceId: workspace.id,
  };

  const { data: genRow, error: genErr } = await admin
    .from("generations")
    .insert({ workspace_id: workspace.id, type: "video", prompt: input.prompt, title: input.prompt.slice(0, 60), status: "processing", aspect_ratio: input.aspectRatio, duration: input.duration + "s", quality: input.quality, style: `t2v-realism-${input.realismMode}` })
    .select("id")
    .single();

  if (genErr || !genRow) return NextResponse.json({ error: "Failed to create record" }, { status: 500 });
  input.generationId = genRow.id;

  let finalUrl: string | undefined;
  let finalScore: T2VQcScore | undefined;
  const allRoundScores: ScoredCandidate[][] = [];

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    try {
      const result = await runRound(input, round);
      allRoundScores.push(result.allScored);
      if (result.accepted && result.bestUrl) {
        try { finalUrl = await uploadVideoUrl(result.bestUrl, workspace.id); }
        catch { finalUrl = result.bestUrl; }
        finalScore = result.bestScore;
        break;
      }
    } catch (err) {
      console.error(`[T2V] Round ${round} error:`, err instanceof Error ? err.message : err);
    }
  }

  if (!finalUrl) {
    await admin.from("generations").update({ status: "failed" }).eq("id", genRow.id);
    return NextResponse.json({ error: "All candidates failed realism QC after 3 rounds", generationId: genRow.id }, { status: 422 });
  }

  const postProcess = await postProcessT2V(finalUrl, workspace.id);
  const outputUrl = postProcess.skipped ? finalUrl : postProcess.outputUrl;
  await admin.from("generations").update({ status: "completed", output_url: outputUrl }).eq("id", genRow.id);

  const expandedPrompt = buildT2VPrompt(input);
  const result: T2VResult = {
    accepted: true, videoUrl: outputUrl, qcScore: finalScore,
    expandedPrompt,
    selectionResult: { accepted: true, attempts: allRoundScores.flat().length, rejectedCandidates: allRoundScores.flat().filter(s => shouldRejectT2VCandidate(s.score)) },
    postProcess, totalAttempts: allRoundScores.flat().length, generationId: genRow.id,
  };

  return NextResponse.json({ ok: true, result });
}
