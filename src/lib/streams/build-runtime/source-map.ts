export interface SourceReference { path: string; reason: string; score: number; }
export function rankSourceRefs(paths: string[], query: string): SourceReference[] {
  const q = query.toLowerCase();
  return paths.map((path) => ({ path, reason: path.toLowerCase().includes(q) ? "path-match" : "fallback", score: path.toLowerCase().includes(q) ? 1 : 0 }));
}
