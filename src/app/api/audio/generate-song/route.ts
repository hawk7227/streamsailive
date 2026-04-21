import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { generateSong } from "@/lib/song-runtime/generateSong";
import { enqueueJob } from "@/lib/jobs/queue";

export const maxDuration = 120;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    prompt?:       string;
    style?:        string;
    title?:        string;
    instrumental?: boolean;
    provider?:     "suno" | "udio" | "auto";
    extractVocals?: boolean;
    async?:        boolean;
    storyBible?:   string;
    voiceDatasetId?: string;
    referenceAudioUrl?: string;
    voiceGuideMode?: string;
    enhanceVocals?: boolean;
    sourceKind?: "self" | "family_or_friend" | "synthetic" | "mixed";
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.prompt?.trim()) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  const admin = createAdminClient();
  const selection = await getCurrentWorkspaceSelection(admin, user);
  const workspaceId = selection.current.workspace.id;

  // Async mode — enqueue job and return immediately
  if (body.async) {
    const job = await enqueueJob("song_gen", {
      prompt:       body.prompt,
      style:        body.style,
      title:        body.title,
      instrumental: body.instrumental,
      provider:     body.provider,
      extractVocals: body.extractVocals,
    }, { workspaceId, userId: user.id, priority: 3 });
    return NextResponse.json({ data: { jobId: job.id, status: "pending" } }, { status: 202 });
  }

  // Sync mode — delegate to the single authoritative song generation gate
  try {
    const result = await generateSong({
      prompt: body.prompt,
      instrumental: body.instrumental,
      genre: body.style,
      referenceAudioUrl: body.referenceAudioUrl ?? undefined,
      requireStems: body.extractVocals ?? false,
      provider: body.provider ?? "auto",
      workspaceId,
    });

    return NextResponse.json({ data: result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Song generation failed" },
      { status: 500 }
    );
  }
}
