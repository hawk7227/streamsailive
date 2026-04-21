/**
 * src/lib/files/importIndexer.ts
 *
 * Resolves import basenames to file IDs and writes file_import_edges rows.
 * Called from uploadOrchestrator.ts after chunkAndIndexFile completes.
 *
 * RESOLUTION STRATEGY
 * ───────────────────
 * Import basenames (e.g. "types", "utils") are matched against file names
 * in the same workspace using a case-insensitive prefix match:
 *   basename "types" → matches "types.ts", "types.tsx", "types.js", etc.
 *
 * This is intentionally imprecise — no full path resolution.
 * A workspace with two files both named "utils.ts" in different directories
 * would match both. This is acceptable: both are likely relevant context.
 *
 * TIMING CONSTRAINT
 * ─────────────────
 * Edges are written from the perspective of the file being uploaded.
 * If auth.ts is uploaded before types.ts, the edge (auth.ts → types.ts)
 * is NOT created at auth.ts upload time — types.ts doesn't exist yet.
 * The edge IS created when types.ts is uploaded (it parses its own imports,
 * not the imports of files that import it).
 *
 * Workaround: re-upload auth.ts after types.ts to create the missing edge.
 * This is a known limitation of the append-only edge strategy.
 * A future slice can add a re-index-all-workspace-files function.
 *
 * RE-INDEXING
 * ───────────
 * On re-upload, existing outgoing edges from this file are deleted first,
 * then new edges are written. This prevents stale edges after refactors.
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolves import basenames to file IDs and writes file_import_edges.
 * No-op if importBasenames is empty.
 *
 * @param fileId          — the file being indexed (from_file_id)
 * @param workspaceId     — scopes file resolution to this workspace
 * @param importBasenames — basenames parsed by parseImportPaths()
 */
export async function indexFileImports(
  fileId: string,
  workspaceId: string,
  importBasenames: string[],
): Promise<void> {
  if (importBasenames.length === 0) return;

  const admin = createAdminClient();

  // ── 1. Resolve basenames to file IDs ──────────────────────────────────────
  // Fetch all files in the workspace — a single query cheaper than N ilike queries.
  const { data: workspaceFiles } = await admin
    .from("files")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .neq("id", fileId); // exclude self-imports

  if (!workspaceFiles?.length) return;

  // Build a map: normalised-basename → file_id.
  // normalised = lowercase, extension stripped, path stripped (last segment only).
  // Multiple files can share the same normalised name — all are included.
  const nameToIds = new Map<string, string[]>();
  for (const f of workspaceFiles) {
    const name = (f.name as string) ?? "";
    const base = name.split("/").pop()?.replace(/\.\w+$/, "").toLowerCase() ?? "";
    if (!base) continue;
    const existing = nameToIds.get(base) ?? [];
    existing.push(f.id as string);
    nameToIds.set(base, existing);
  }

  // Collect all to_file_ids from the parsed basenames
  const toFileIds = new Set<string>();
  for (const basename of importBasenames) {
    const normalised = basename.toLowerCase();
    const ids = nameToIds.get(normalised) ?? [];
    for (const id of ids) toFileIds.add(id);
  }

  if (toFileIds.size === 0) return;

  // ── 2. Delete existing outgoing edges from this file ──────────────────────
  // Prevents stale edges after a refactor changes which files are imported.
  await admin
    .from("file_import_edges")
    .delete()
    .eq("from_file_id", fileId);

  // ── 3. Insert new edges ───────────────────────────────────────────────────
  const edges = [...toFileIds].map((toId) => ({
    workspace_id: workspaceId,
    from_file_id: fileId,
    to_file_id: toId,
    created_at: new Date().toISOString(),
  }));

  const { error } = await admin
    .from("file_import_edges")
    .insert(edges)
    .select("id"); // confirm rows were written

  if (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "IMPORT_EDGES_INSERT_FAILED",
      fileId,
      workspaceId,
      edgeCount: edges.length,
      reason: error.message,
    }));
    return;
  }

  console.log(JSON.stringify({
    level: "info",
    event: "IMPORT_EDGES_INDEXED",
    fileId,
    workspaceId,
    importBasenames: importBasenames.length,
    edgesWritten: edges.length,
    resolvedFileIds: [...toFileIds],
  }));
}
