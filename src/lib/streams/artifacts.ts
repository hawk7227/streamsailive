/**
 * src/lib/streams/artifacts.ts
 *
 * Runtime helper for the Artifact Registry (Phase 4).
 *
 * Core operations:
 *   createArtifact()     — create a new artifact + first version atomically
 *   addVersion()         — append a new version, update current_version_id
 *   getArtifact()        — load artifact + current version
 *   listArtifacts()      — list artifacts for a project
 *   proveVersion()       — mark a version as Proven with evidence
 *   rejectVersion()      — mark a version as Rejected
 *
 * Versioning rules:
 *   - version_number auto-increments per artifact (not global)
 *   - current_version_id always points to the latest version
 *   - old versions are immutable — never updated, only appended to
 *   - proof state on artifact reflects the current version's proof state
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ArtifactType =
  | "code" | "doc" | "image" | "video"
  | "svg"  | "react" | "html" | "schema" | "prompt_pack";

export type ArtifactState = "draft" | "stable" | "deprecated" | "archived";

export type ArtifactProofState =
  | "Unproven" | "ImplementedButUnproven" | "Proven" | "Rejected";

export type ArtifactOrigin = "generated" | "edited" | "imported";

export interface ArtifactRow {
  id:                string;
  workspaceId:       string;
  projectId:         string | null;
  name:              string;
  slug:              string;
  description:       string | null;
  artifactType:      ArtifactType;
  state:             ArtifactState;
  proofState:        ArtifactProofState;
  currentVersionId:  string | null;
  origin:            ArtifactOrigin;
  previewUrl:        string | null;
  generationLogId:   string | null;
  sessionId:         string | null;
  tags:              string[];
  createdAt:         string;
  updatedAt:         string;
}

export interface ArtifactVersionRow {
  id:               string;
  artifactId:       string;
  workspaceId:      string;
  versionNumber:    number;
  contentText:      string | null;
  contentUrl:       string | null;
  contentType:      string | null;
  contentSizeBytes: number | null;
  changeSummary:    string | null;
  proofState:       ArtifactProofState;
  proofEvidence:    string | null;
  origin:           ArtifactOrigin;
  previewUrl:       string | null;
  sessionId:        string | null;
  generationLogId:  string | null;
  createdAt:        string;
}

export interface ArtifactWithVersion extends ArtifactRow {
  currentVersion: ArtifactVersionRow | null;
}

export interface CreateArtifactInput {
  workspaceId:      string;
  projectId?:       string | null;
  name:             string;
  slug:             string;
  description?:     string;
  artifactType:     ArtifactType;
  origin?:          ArtifactOrigin;
  tags?:            string[];
  sessionId?:       string;
  generationLogId?: string;
  // first version content
  contentText?:     string;
  contentUrl?:      string;
  contentType?:     string;
  contentSizeBytes?: number;
  previewUrl?:      string;
  changeSummary?:   string;
}

export interface AddVersionInput {
  artifactId:       string;
  workspaceId:      string;
  contentText?:     string;
  contentUrl?:      string;
  contentType?:     string;
  contentSizeBytes?: number;
  changeSummary?:   string;
  origin?:          ArtifactOrigin;
  previewUrl?:      string;
  sessionId?:       string;
  generationLogId?: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapArtifact(r: Record<string, unknown>): ArtifactRow {
  return {
    id:               r.id as string,
    workspaceId:      r.workspace_id as string,
    projectId:        r.project_id as string | null,
    name:             r.name as string,
    slug:             r.slug as string,
    description:      r.description as string | null,
    artifactType:     r.artifact_type as ArtifactType,
    state:            r.state as ArtifactState,
    proofState:       r.proof_state as ArtifactProofState,
    currentVersionId: r.current_version_id as string | null,
    origin:           r.origin as ArtifactOrigin,
    previewUrl:       r.preview_url as string | null,
    generationLogId:  r.generation_log_id as string | null,
    sessionId:        r.session_id as string | null,
    tags:             r.tags as string[],
    createdAt:        r.created_at as string,
    updatedAt:        r.updated_at as string,
  };
}

function mapVersion(r: Record<string, unknown>): ArtifactVersionRow {
  return {
    id:               r.id as string,
    artifactId:       r.artifact_id as string,
    workspaceId:      r.workspace_id as string,
    versionNumber:    r.version_number as number,
    contentText:      r.content_text as string | null,
    contentUrl:       r.content_url as string | null,
    contentType:      r.content_type as string | null,
    contentSizeBytes: r.content_size_bytes as number | null,
    changeSummary:    r.change_summary as string | null,
    proofState:       r.proof_state as ArtifactProofState,
    proofEvidence:    r.proof_evidence as string | null,
    origin:           r.origin as ArtifactOrigin,
    previewUrl:       r.preview_url as string | null,
    sessionId:        r.session_id as string | null,
    generationLogId:  r.generation_log_id as string | null,
    createdAt:        r.created_at as string,
  };
}

// ── Create artifact + first version (atomic) ──────────────────────────────────

export async function createArtifact(
  admin: SupabaseClient,
  userId: string,
  input: CreateArtifactInput,
): Promise<ArtifactWithVersion> {
  // 1. Insert artifact (current_version_id null until version created)
  const { data: artifactRaw, error: artifactError } = await admin
    .from("artifacts")
    .insert({
      workspace_id:      input.workspaceId,
      project_id:        input.projectId ?? null,
      name:              input.name,
      slug:              input.slug,
      description:       input.description ?? null,
      artifact_type:     input.artifactType,
      origin:            input.origin ?? "generated",
      tags:              input.tags ?? [],
      session_id:        input.sessionId ?? null,
      generation_log_id: input.generationLogId ?? null,
      state:             "draft",
      proof_state:       "Unproven",
      created_by:        userId,
    })
    .select()
    .single();

  if (artifactError) throw new Error(`Artifact create failed: ${artifactError.message}`);

  const artifact = mapArtifact(artifactRaw as Record<string, unknown>);

  // 2. Insert first version
  const { data: versionRaw, error: versionError } = await admin
    .from("artifact_versions")
    .insert({
      artifact_id:        artifact.id,
      workspace_id:       input.workspaceId,
      version_number:     1,
      content_text:       input.contentText ?? null,
      content_url:        input.contentUrl ?? null,
      content_type:       input.contentType ?? null,
      content_size_bytes: input.contentSizeBytes ?? null,
      change_summary:     input.changeSummary ?? "Initial version",
      origin:             input.origin ?? "generated",
      preview_url:        input.previewUrl ?? null,
      session_id:         input.sessionId ?? null,
      generation_log_id:  input.generationLogId ?? null,
      proof_state:        "Unproven",
      created_by:         userId,
    })
    .select()
    .single();

  if (versionError) throw new Error(`Version create failed: ${versionError.message}`);

  const version = mapVersion(versionRaw as Record<string, unknown>);

  // 3. Point artifact at its first version
  const { error: updateError } = await admin
    .from("artifacts")
    .update({
      current_version_id: version.id,
      updated_at:         new Date().toISOString(),
    })
    .eq("id", artifact.id);

  if (updateError) throw new Error(`Artifact version pointer update failed: ${updateError.message}`);

  return { ...artifact, currentVersionId: version.id, currentVersion: version };
}

// ── Add a new version ─────────────────────────────────────────────────────────

export async function addVersion(
  admin: SupabaseClient,
  userId: string,
  input: AddVersionInput,
): Promise<ArtifactVersionRow> {
  // Get current max version number for this artifact
  const { data: maxRaw } = await admin
    .from("artifact_versions")
    .select("version_number")
    .eq("artifact_id", input.artifactId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = maxRaw ? (maxRaw.version_number as number) + 1 : 1;

  const { data: versionRaw, error: versionError } = await admin
    .from("artifact_versions")
    .insert({
      artifact_id:        input.artifactId,
      workspace_id:       input.workspaceId,
      version_number:     nextVersion,
      content_text:       input.contentText ?? null,
      content_url:        input.contentUrl ?? null,
      content_type:       input.contentType ?? null,
      content_size_bytes: input.contentSizeBytes ?? null,
      change_summary:     input.changeSummary ?? null,
      origin:             input.origin ?? "edited",
      preview_url:        input.previewUrl ?? null,
      session_id:         input.sessionId ?? null,
      generation_log_id:  input.generationLogId ?? null,
      proof_state:        "Unproven",
      created_by:         userId,
    })
    .select()
    .single();

  if (versionError) throw new Error(`Version insert failed: ${versionError.message}`);

  const version = mapVersion(versionRaw as Record<string, unknown>);

  // Update artifact to point at new version
  await admin
    .from("artifacts")
    .update({
      current_version_id: version.id,
      proof_state:        "ImplementedButUnproven",
      updated_at:         new Date().toISOString(),
    })
    .eq("id", input.artifactId);

  return version;
}

// ── Get artifact + current version ───────────────────────────────────────────

export async function getArtifact(
  admin: SupabaseClient,
  artifactId: string,
  workspaceId: string,
): Promise<ArtifactWithVersion | null> {
  const { data: artifactRaw, error } = await admin
    .from("artifacts")
    .select()
    .eq("id", artifactId)
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !artifactRaw) return null;

  const artifact = mapArtifact(artifactRaw as Record<string, unknown>);

  let currentVersion: ArtifactVersionRow | null = null;
  if (artifact.currentVersionId) {
    const { data: versionRaw } = await admin
      .from("artifact_versions")
      .select()
      .eq("id", artifact.currentVersionId)
      .single();
    if (versionRaw) currentVersion = mapVersion(versionRaw as Record<string, unknown>);
  }

  return { ...artifact, currentVersion };
}

// ── List artifacts for a project ──────────────────────────────────────────────

export async function listArtifacts(
  admin: SupabaseClient,
  workspaceId: string,
  options?: {
    projectId?: string;
    artifactType?: ArtifactType;
    state?: ArtifactState;
    limit?: number;
  },
): Promise<ArtifactRow[]> {
  let query = admin
    .from("artifacts")
    .select()
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(options?.limit ?? 50);

  if (options?.projectId)    query = query.eq("project_id", options.projectId);
  if (options?.artifactType) query = query.eq("artifact_type", options.artifactType);
  if (options?.state)        query = query.eq("state", options.state);

  const { data, error } = await query;
  if (error) throw new Error(`List artifacts failed: ${error.message}`);

  return (data ?? []).map((r: Record<string, unknown>) => mapArtifact(r));
}

// ── List versions for an artifact ─────────────────────────────────────────────

export async function listVersions(
  admin: SupabaseClient,
  artifactId: string,
  workspaceId: string,
): Promise<ArtifactVersionRow[]> {
  const { data, error } = await admin
    .from("artifact_versions")
    .select()
    .eq("artifact_id", artifactId)
    .eq("workspace_id", workspaceId)
    .order("version_number", { ascending: false });

  if (error) throw new Error(`List versions failed: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapVersion(r));
}

// ── Prove a version ───────────────────────────────────────────────────────────

export async function proveVersion(
  admin: SupabaseClient,
  versionId: string,
  artifactId: string,
  workspaceId: string,
  evidence: string,
): Promise<void> {
  await admin
    .from("artifact_versions")
    .update({ proof_state: "Proven", proof_evidence: evidence })
    .eq("id", versionId)
    .eq("workspace_id", workspaceId);

  // Promote artifact proof state and state to stable
  await admin
    .from("artifacts")
    .update({
      proof_state: "Proven",
      state:       "stable",
      updated_at:  new Date().toISOString(),
    })
    .eq("id", artifactId)
    .eq("workspace_id", workspaceId);
}

// ── Reject a version ──────────────────────────────────────────────────────────

export async function rejectVersion(
  admin: SupabaseClient,
  versionId: string,
  artifactId: string,
  workspaceId: string,
  reason: string,
): Promise<void> {
  await admin
    .from("artifact_versions")
    .update({ proof_state: "Rejected", proof_evidence: reason })
    .eq("id", versionId)
    .eq("workspace_id", workspaceId);

  await admin
    .from("artifacts")
    .update({
      proof_state: "Rejected",
      updated_at:  new Date().toISOString(),
    })
    .eq("id", artifactId)
    .eq("workspace_id", workspaceId);
}
