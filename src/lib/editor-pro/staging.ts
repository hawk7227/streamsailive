export type StagedChange = {
  id: string
  owner: string
  repo: string
  branch: string
  path: string
  originalContent: string
  nextContent: string
  language: string
  createdAt: number
  source: 'chat-html' | 'chat-code' | 'manual'
}
const KEY = 'streamsai:staged-changes'
export function loadStagedChanges(): StagedChange[] {
  if (typeof window === 'undefined') return []
  try { const raw = window.localStorage.getItem(KEY); return raw ? JSON.parse(raw) : [] } catch { return [] }
}
export function saveStagedChanges(changes: StagedChange[]) { if (typeof window !== 'undefined') window.localStorage.setItem(KEY, JSON.stringify(changes)) }
export function stageChange(change: StagedChange) { const next = loadStagedChanges().filter((x) => x.id !== change.id); next.unshift(change); saveStagedChanges(next) }
export function clearStagedChange(id: string) { saveStagedChanges(loadStagedChanges().filter((x) => x.id !== id)) }
export function createLineDiff(before: string, after: string): string[] {
  const a = before.split('\n'); const b = after.split('\n'); const max = Math.max(a.length, b.length); const out: string[] = []
  for (let i = 0; i < max; i += 1) { const left = a[i]; const right = b[i]; if (left === right) { if (left !== undefined) out.push(`  ${left}`); continue } if (left !== undefined) out.push(`- ${left}`); if (right !== undefined) out.push(`+ ${right}`) }
  return out
}
