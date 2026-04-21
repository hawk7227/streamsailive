/**
 * src/lib/files/importParser.ts
 *
 * Pure function that extracts import basenames from source file text.
 * No DB calls. No side effects. Fully testable in isolation.
 *
 * SCOPE
 * ─────
 * Only relative imports are returned — those starting with './' or '../'.
 * Absolute imports (bare module names, '@/' aliases, 'react', 'next', etc.)
 * are external dependencies and cannot be resolved to uploaded file IDs.
 *
 * SUPPORTED PATTERNS
 * ──────────────────
 * TypeScript / JavaScript:
 *   import { x } from "./foo"
 *   import { x } from '../bar/baz'
 *   import "./side-effect"
 *   import type { T } from "./types"
 *   const x = require("./utils")
 *   export { x } from "./re-exports"
 *   export * from "../shared"
 *
 * Python:
 *   from .types import User
 *   from ..utils import helper
 *   import .sibling            (uncommon but valid)
 *
 * The function does NOT need to be exhaustive — it is additive context.
 * A missed import means the imported file's chunks are not augmented into
 * the retrieval result. The primary semantic search still works correctly.
 *
 * ROUTING MISS PROCEDURE
 * ──────────────────────
 * If a real import pattern is not being detected:
 *   1. Add the pattern to the TS_IMPORT_RE or PYTHON_IMPORT_RE regex
 *   2. Add a test in __tests__/importParser.test.ts
 *   3. Commit both: git commit -m "fix(importParser): add '<pattern>'"
 */

// ── File kind detection ────────────────────────────────────────────────────────

const TS_JS_EXTS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
]);

const PYTHON_EXTS = new Set(["py"]);

function getExt(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

// ── Import pattern regexes ────────────────────────────────────────────────────

// Matches: import ... from "./path" | import "./path" | export ... from "./path"
// Capture group 1: the raw import path string (with quotes stripped)
const TS_IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+(?:\s*,\s*\{[^}]*\})?|\w+(?:\s*,\s*\w+)*)\s+from\s+['"]([^'"]+)['"]|(?:import|export)\s+['"]([^'"]+)['"]|(?:\brequire\s*\(\s*['"]([^'"]+)['"]\s*\))/g;

// Matches: from .foo import ... | from ..bar import ...
const PYTHON_IMPORT_RE = /^\s*from\s+(\.+[\w./]*)\s+import\b/gm;

// ── Path normalisation ────────────────────────────────────────────────────────

/**
 * Extracts the basename from a relative import path.
 * Returns null for non-relative (external) imports.
 *
 * Examples:
 *   "./types"       → "types"
 *   "../lib/utils"  → "utils"
 *   ".types"        → "types"       (Python relative)
 *   "react"         → null          (external)
 *   "@/lib/types"   → null          (alias)
 */
function toBasename(importPath: string): string | null {
  const trimmed = importPath.trim();
  if (!trimmed.startsWith(".")) return null;

  // Strip leading ./ or ../ sequences and get the last path segment
  const segments = trimmed.replace(/^\.+\//, "").split("/");
  const last = segments[segments.length - 1];

  if (!last || last === "." || last === "..") return null;

  // Strip file extension if present (e.g. "./foo.js" → "foo")
  return last.replace(/\.\w+$/, "");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns unique import basenames from relative imports in the source text.
 * Empty array for non-code files or files with no relative imports.
 *
 * @param text     — source file content
 * @param fileName — used to detect language (extension-based)
 */
export function parseImportPaths(text: string, fileName: string): string[] {
  const ext = getExt(fileName);
  const basenames = new Set<string>();

  if (TS_JS_EXTS.has(ext)) {
    for (const match of text.matchAll(TS_IMPORT_RE)) {
      // Three capture groups — only one fires per match
      const raw = match[1] ?? match[2] ?? match[3];
      if (!raw) continue;
      const basename = toBasename(raw);
      if (basename) basenames.add(basename);
    }
  } else if (PYTHON_EXTS.has(ext)) {
    for (const match of text.matchAll(PYTHON_IMPORT_RE)) {
      const raw = match[1];
      if (!raw) continue;
      // Python: ".types" → "types", "..utils" → "utils"
      const stripped = raw.replace(/^\.+/, "");
      if (!stripped) continue;
      const parts = stripped.split(".");
      const last = parts[parts.length - 1];
      if (last) basenames.add(last);
    }
  }

  return [...basenames];
}
