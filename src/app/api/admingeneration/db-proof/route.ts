import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = getSupabaseServiceClient();

    const { data: analysis, error: analysisError } = await supabase
      .from("admingeneration_analyses")
      .insert({
        source_type: "db_proof",
        source_url: "db-proof://source-video.mp4",
        status: "analyzed",
        intelligence: {
          transcript: {
            words: [
              { word: "Proof", start: 0, end: 0.4, speaker: "speaker-1" },
              { word: "timeline", start: 0.4, end: 0.9, speaker: "speaker-1" },
              { word: "works", start: 0.9, end: 1.3, speaker: "speaker-1" }
            ]
          }
        },
        metadata: { proof: true }
      })
      .select("*")
      .single();

    if (analysisError) throw analysisError;

    const { data: project, error: projectError } = await supabase
      .from("admingeneration_editor_projects")
      .insert({
        analysis_id: analysis.id,
        title: "DB Proof Editor Project",
        status: "active",
        metadata: { proof: true }
      })
      .select("*")
      .single();

    if (projectError) throw projectError;

    const { data: asset, error: assetError } = await supabase
      .from("admingeneration_assets")
      .insert({
        project_id: project.id,
        analysis_id: analysis.id,
        asset_kind: "source_video",
        asset_url: "db-proof://source-video.mp4",
        mime_type: "video/mp4",
        duration_sec: 3,
        metadata: { proof: true }
      })
      .select("*")
      .single();

    if (assetError) throw assetError;

    const { data: segment, error: segmentError } = await supabase
      .from("admingeneration_timeline_segments")
      .insert({
        project_id: project.id,
        analysis_id: analysis.id,
        segment_kind: "dialogue",
        label: "Proof timeline segment",
        start_sec: 0,
        end_sec: 3,
        frame_start: 0,
        frame_end: 72,
        source_asset_id: asset.id,
        metadata: { proof: true }
      })
      .select("*")
      .single();

    if (segmentError) throw segmentError;

    const { data: speaker, error: speakerError } = await supabase
      .from("admingeneration_speakers")
      .insert({
        project_id: project.id,
        label: "Speaker 1",
        metadata: { proof: true }
      })
      .select("*")
      .single();

    if (speakerError) throw speakerError;

    const { error: wordsError } = await supabase
      .from("admingeneration_transcript_words")
      .insert([
        { project_id: project.id, segment_id: segment.id, speaker_id: speaker.id, word: "Proof", start_sec: 0, end_sec: 0.4, frame_start: 0, frame_end: 10 },
        { project_id: project.id, segment_id: segment.id, speaker_id: speaker.id, word: "timeline", start_sec: 0.4, end_sec: 0.9, frame_start: 10, frame_end: 22 },
        { project_id: project.id, segment_id: segment.id, speaker_id: speaker.id, word: "works", start_sec: 0.9, end_sec: 1.3, frame_start: 22, frame_end: 32 }
      ]);

    if (wordsError) throw wordsError;

    const { data: version, error: versionError } = await supabase
      .from("admingeneration_versions")
      .insert({
        project_id: project.id,
        status: "source",
        change_summary: "Immutable source proof version",
        output_asset_id: asset.id,
        metadata: { proof: true }
      })
      .select("*")
      .single();

    if (versionError) throw versionError;

    const [{ data: readProject }, { data: readSegments }, { data: readWords }, { data: readVersions }] =
      await Promise.all([
        supabase.from("admingeneration_editor_projects").select("*").eq("id", project.id).single(),
        supabase.from("admingeneration_timeline_segments").select("*").eq("project_id", project.id),
        supabase.from("admingeneration_transcript_words").select("*").eq("project_id", project.id),
        supabase.from("admingeneration_versions").select("*").eq("project_id", project.id),
      ]);

    return NextResponse.json({
      ok: true,
      status: "db_write_read_proven",
      projectId: project.id,
      analysisId: analysis.id,
      proof: {
        projectWritten: Boolean(project.id),
        assetWritten: Boolean(asset.id),
        segmentWritten: Boolean(segment.id),
        speakerWritten: Boolean(speaker.id),
        versionWritten: Boolean(version.id),
        readBackProject: Boolean(readProject?.id),
        readBackSegments: readSegments?.length || 0,
        readBackWords: readWords?.length || 0,
        readBackVersions: readVersions?.length || 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "db_proof_failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
