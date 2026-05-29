export type Severity = 'critical' | 'warning' | 'info'
export type GateKey = 'structure' | 'code' | 'ux' | 'mobile' | 'performance' | 'reliability' | 'release'
export type RunStage = 'idle' | 'queued' | 'running' | 'passed' | 'failed'

export type AuditIssue = {
  id: string
  fileName: string
  gate: GateKey
  severity: Severity
  title: string
  detail: string
  fix: string
}

export type GateResult = {
  key: GateKey
  label: string
  score: number
  passed: boolean
  issues: number
}

export type GateStatus = {
  key: GateKey
  label: string
  stage: RunStage
  issues: number
  score: number | null
}

export type AuditedFile = {
  id: string
  name: string
  size: number
  type: string
  textPreview: string
  score: number
  status: 'queued' | 'hashing' | 'scanning' | 'testing' | 'scoring' | 'complete' | 'failed'
  issues: AuditIssue[]
}

export type AuditSummary = {
  overallScore: number
  releaseStatus: 'ready' | 'needs work' | 'blocked'
  criticalIssues: number
  warnings: number
  filesAudited: number
  directoriesAudited: number
  ciReady: boolean
}

export type AuditReport = {
  summary: AuditSummary
  gates: GateResult[]
  gateStatuses?: GateStatus[]
  issues: AuditIssue[]
  files: AuditedFile[]
  createdAt: string
  rootPath?: string
}

export const GATES: Array<{ key: GateKey; label: string }> = [
  { key: 'structure', label: 'Structure' },
  { key: 'code', label: 'Code Quality' },
  { key: 'ux', label: 'UX Polish' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'performance', label: 'Performance' },
  { key: 'reliability', label: 'Reliability' },
  { key: 'release', label: 'Release' },
]

const TEXT_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.md', '.html', '.yml', '.yaml', '.txt', '.mjs', '.cjs'
]

export function isTextLikeFile(name: string, type?: string): boolean {
  const lower = name.toLowerCase()
  return TEXT_EXTENSIONS.some(ext => lower.endsWith(ext)) || !!type?.startsWith('text/') || type === 'application/json'
}

export function makeIssue(fileName: string, gate: GateKey, severity: Severity, title: string, detail: string, fix: string): AuditIssue {
  return {
    id: `${fileName}-${gate}-${title}`.replace(/\s+/g, '-').toLowerCase(),
    fileName,
    gate,
    severity,
    title,
    detail,
    fix,
  }
}

export function penaltyFor(issues: AuditIssue[]): number {
  return issues.reduce((sum, issue) => sum + (issue.severity === 'critical' ? 18 : issue.severity === 'warning' ? 8 : 3), 0)
}

export function emptyGateStatuses(): GateStatus[] {
  return GATES.map((gate) => ({
    key: gate.key,
    label: gate.label,
    stage: 'idle',
    issues: 0,
    score: null,
  }))
}

export function applyGateResults(statuses: GateStatus[], report: AuditReport): GateStatus[] {
  return statuses.map((status) => {
    const gate = report.gates.find((entry) => entry.key === status.key)
    return gate
      ? {
          ...status,
          stage: gate.passed ? 'passed' : 'failed',
          issues: gate.issues,
          score: gate.score,
        }
      : status
  })
}

export function buildHonestFeedback(report: AuditReport, question?: string): string {
  const weakest = [...report.gates].sort((a, b) => a.score - b.score).slice(0, 3)
  const blockers = report.issues.filter((issue) => issue.severity === 'critical').slice(0, 4)
  const notable = (blockers.length ? blockers : report.issues.slice(0, 4))
  const releaseLine =
    report.summary.releaseStatus === 'blocked'
      ? 'Do not ship this yet.'
      : report.summary.releaseStatus === 'needs work'
      ? 'This is not release-clean yet.'
      : 'This is in release range based on the current scan.'

  return [
    releaseLine,
    `Overall score ${report.summary.overallScore}. Files audited: ${report.summary.filesAudited}. Critical issues: ${report.summary.criticalIssues}. Warnings: ${report.summary.warnings}.`,
    weakest.length ? `Weakest gates: ${weakest.map((gate) => `${gate.label} ${gate.score}`).join(', ')}.` : '',
    notable.length ? `Highest-risk findings: ${notable.map((issue) => `${issue.fileName}: ${issue.title}`).join(' | ')}.` : 'No major issues were detected in the uploaded files.',
    question ? `Question: ${question.trim()}` : '',
    notable[0] ? `Fix first: ${notable[0].fileName}. ${notable[0].fix}` : 'Fix first: upload the full repo so cross-file checks can run.',
  ].filter(Boolean).join(' ')
}
