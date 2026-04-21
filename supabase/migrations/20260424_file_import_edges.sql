-- Migration: file_import_edges
--
-- Stores directed import relationships between files in a workspace.
-- Populated at file index time by parsing import/require statements.
-- Used at retrieval time to augment results with chunks from imported files.
--
-- Example:
--   auth.ts imports ./types → edge (auth.ts → types.ts)
--   Retrieval: auth.ts appears in results → types.ts chunks are added to context
--
-- Only relative imports are indexed (./foo, ../lib/bar).
-- Absolute imports (react, @/lib/foo) are external — not resolvable to file IDs.
--
-- Edges are append-only. Re-indexing a file deletes its outgoing edges first
-- (handled in importIndexer.ts, not here).

CREATE TABLE IF NOT EXISTS file_import_edges (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL,
  from_file_id UUID        NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  to_file_id   UUID        NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One edge per (from, to) pair — prevents duplicates on re-index
  UNIQUE (from_file_id, to_file_id)
);

-- Primary retrieval-time lookup: given a set of from_file_ids, find all to_file_ids
CREATE INDEX IF NOT EXISTS idx_file_import_edges_from
  ON file_import_edges(from_file_id);

-- Workspace-scoped listing for future admin/debug tooling
CREATE INDEX IF NOT EXISTS idx_file_import_edges_workspace
  ON file_import_edges(workspace_id);

COMMENT ON TABLE file_import_edges IS
  'Directed import relationships between files. from_file_id imports to_file_id. '
  'Used at retrieval time to include chunks from imported files alongside directly-matched files.';

COMMENT ON COLUMN file_import_edges.from_file_id IS
  'The file that contains the import statement.';

COMMENT ON COLUMN file_import_edges.to_file_id IS
  'The file being imported. Resolved from relative import path to file ID at index time.';
