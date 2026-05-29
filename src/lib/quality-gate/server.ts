import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  GATES,
  applyGateResults,
  emptyGateStatuses,
  isTextLikeFile,
  makeIssue,
  penaltyFor,
  type AuditIssue,
  type AuditReport,
  type AuditedFile,
  type GateKey,
  type GateStatus,
} from '@/lib/quality-gate'

const execFileAsync = promisify(execFile)
const ROOT = path.join(os.tmpdir(), 'streamsai-quality-gate')
const MAX_TEXT_BYTES = 160_000
const MAX_FILES = 400
const IGNORE_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.turbo'])

type UploadedFileMeta = {
  originalName: string
  storedPath: string
  relativePath: string
  size: number
  type: string
}

type UploadRecord = {
  id: string
  rootDir: string
  createdAt: string
  files: UploadedFileMeta[]
  extractedRoots: string[]
}

type RunRecord = {
  id: string
  uploadId: string
  createdAt: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  gateStatuses: GateStatus[]
  report: AuditReport | null
  error: string | null
}

const uploads = new Map<string, UploadRecord>()
const runs = new Map<string, RunRecord>()

async function ensureRoot() {
  await fs.mkdir(ROOT, { recursive: true })
}

function sanitizeRelativePath(input: string): string {
  const normalized = input.replace(/\\/g, '/').replace(/^\/+/, '')
  const safeParts = normalized.split('/').filter(Boolean).filter((part) => part !== '..' && part !== '.')
  return safeParts.join('/') || `file-${Date.now()}`
}

async function ensureParent(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

async function writeFile(file: File, outPath: string) {
  const buffer = Buffer.from(await file.arrayBuffer())
  await ensureParent(outPath)
  await fs.writeFile(outPath, buffer)
}

async function walkFiles(rootDir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.github') continue
      if (entry.isDirectory() && IGNORE_DIRS.has(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else {
        out.push(full)
        if (out.length >= MAX_FILES) return
      }
    }
  }
  await walk(rootDir)
  return out
}

async function tryUnzip(zipPath: string, outDir: string): Promise<boolean> {
  try {
    await fs.mkdir(outDir, { recursive: true })
    await execFileAsync('unzip', ['-qq', zipPath, '-d', outDir])
    return true
  } catch {
    return false
  }
}

async function readPreview(fullPath: string): Promise<string> {
  const ext = path.extname(fullPath).toLowerCase()
  if (!isTextLikeFile(fullPath, ext === '.json' ? 'application/json' : undefined)) return ''
  const buffer = await fs.readFile(fullPath)
  return buffer.subarray(0, MAX_TEXT_BYTES).toString('utf8')
}

function relativeTo(rootDir: string, fullPath: string) {
  return path.relative(rootDir, fullPath).replace(/\\/g, '/')
}

function fileId(name: string) {
  return crypto.createHash('sha1').update(name).digest('hex').slice(0, 12)
}

function updateGate(record: RunRecord, key: GateKey, update: Partial<GateStatus>) {
  record.gateStatuses = record.gateStatuses.map((gate) => gate.key === key ? { ...gate, ...update } : gate)
  runs.set(record.id, record)
}

function hasFile(files: AnalyzedInputFile[], matcher: RegExp) {
  return files.some((file) => matcher.test(file.name))
}

type AnalyzedInputFile = {
  id: string
  name: string
  size: number
  type: string
  textPreview: string
}

function buildGateResult(key: GateKey, issues: AuditIssue[]) {
  return {
    key,
    label: GATES.find((entry) => entry.key === key)?.label || key,
    score: Math.max(8, 100 - penaltyFor(issues)),
    passed: !issues.some((issue) => issue.severity === 'critical'),
    issues: issues.length,
  }
}

function inspectFile(file: AnalyzedInputFile): AuditIssue[] {
  const issues: AuditIssue[] = []
  const text = file.textPreview || ''
  const lower = text.toLowerCase()
  const name = file.name
  const ext = path.extname(name).toLowerCase()

  if (file.size > 2_500_000) {
    issues.push(makeIssue(name, 'performance', 'warning', 'Large file size', 'Large files slow builds, scans, and future maintenance.', 'Split oversized files or assets into smaller modules.'))
  }
  if (/todo|fixme|xxx/i.test(text)) {
    issues.push(makeIssue(name, 'release', 'warning', 'Unfinished markers found', 'TODO / FIXME markers are still in a shipped path.', 'Resolve unfinished markers before release.'))
  }
  if (/\bany\b/.test(text) && /\.tsx?$/.test(name)) {
    issues.push(makeIssue(name, 'code', 'warning', 'Loose typing found', 'The file uses any, which weakens safety.', 'Replace any with explicit types or validated unknown values.'))
  }
  if (/console\.log\s*\(/.test(text)) {
    issues.push(makeIssue(name, 'release', 'info', 'Console logging left in file', 'Debug logging is still present in the file.', 'Strip debug logs from release code paths.'))
  }
  if (/useEffect\s*\(/.test(text) && /addEventListener\(/.test(text) && !/removeEventListener\(/.test(text)) {
    issues.push(makeIssue(name, 'reliability', 'critical', 'Listener cleanup missing', 'A listener appears to be attached without cleanup.', 'Return a cleanup function that removes listeners on unmount.'))
  }
  if (/setInterval\(/.test(text) && !/clearInterval\(/.test(text)) {
    issues.push(makeIssue(name, 'reliability', 'critical', 'Timer cleanup missing', 'An interval is created without clearInterval.', 'Clear intervals on cleanup or teardown.'))
  }
  if (/fetch\(/.test(text) && !/catch\(/.test(text) && !/try\s*\{/.test(text)) {
    issues.push(makeIssue(name, 'reliability', 'warning', 'Network failure path unclear', 'A fetch call appears without clear failure handling.', 'Handle failed requests and return helpful recovery states.'))
  }
  if (/100vh/.test(text) && !/100dvh/.test(text)) {
    issues.push(makeIssue(name, 'mobile', 'warning', 'Viewport unit may jump on mobile', '100vh can cause browser bar jumps on phones.', 'Prefer 100dvh for app-like mobile surfaces.'))
  }
  if (/safe-area-inset/.test(text) === false && /(bottom sheet|safe area|iphone|mobile)/i.test(lower) && /position\s*:\s*["']?fixed/.test(text)) {
    issues.push(makeIssue(name, 'mobile', 'warning', 'Safe-area support not obvious', 'A fixed mobile surface appears without visible safe-area support.', 'Add safe-area padding for notch and home indicator areas.'))
  }
  if (/transition\s*:\s*["'][^"']*(400ms|500ms|600ms)/.test(text)) {
    issues.push(makeIssue(name, 'ux', 'info', 'Slow transition timing', 'Heavy transitions can make the UI feel webby.', 'Keep primary interactions near 120–240ms.'))
  }
  if (/shadow/i.test(text) && /(0 20px 60px|0px 20px 60px)/.test(text)) {
    issues.push(makeIssue(name, 'ux', 'info', 'Heavy shadow usage', 'Very large shadows often make the UI feel less premium.', 'Reduce shadow spread and opacity.'))
  }
  if (/iframe/i.test(text) && !/title=/.test(text)) {
    issues.push(makeIssue(name, 'ux', 'info', 'iframe title missing', 'Embedded frames should be labeled for clarity and accessibility.', 'Add a descriptive iframe title.'))
  }
  if (/button/i.test(text) && !/aria-label/.test(text) && /<button[^>]*>\s*<\//.test(text)) {
    issues.push(makeIssue(name, 'ux', 'warning', 'Button labeling may be weak', 'Buttons without visible or accessible labels feel unfinished.', 'Add visible text or aria-label attributes.'))
  }
  if (!text.trim() && ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.html', '.md'].includes(ext)) {
    issues.push(makeIssue(name, 'structure', 'warning', 'No readable content extracted', 'The file could not be inspected deeply.', 'Upload the source directly or ensure the file is text-readable.'))
  }

  return issues
}

function inspectRepo(files: AnalyzedInputFile[]): AuditIssue[] {
  const issues: AuditIssue[] = []
  const names = files.map((file) => file.name)
  const lowerNames = new Set(names.map((name) => name.toLowerCase()))

  if (!hasFile(files, /(^|\/)package\.json$/)) {
    issues.push(makeIssue('repo', 'structure', 'critical', 'package.json missing', 'A JavaScript app repo should expose package.json at the root or app root.', 'Include package.json so dependencies and scripts are explicit.'))
  }
  if (!hasFile(files, /(^|\/)tsconfig(\..+)?\.json$/)) {
    issues.push(makeIssue('repo', 'code', 'warning', 'TypeScript config missing', 'No tsconfig file was found, which weakens static enforcement.', 'Add a tsconfig.json for consistent typing and build rules.'))
  }
  if (!hasFile(files, /(^|\/)README\.md$/i)) {
    issues.push(makeIssue('repo', 'release', 'warning', 'README missing', 'No README was found for setup and release guidance.', 'Add a README with install, run, and deployment notes.'))
  }
  if (!hasFile(files, /^\.github\/workflows\/quality-gate\.yml$/)) {
    issues.push(makeIssue('repo', 'release', 'warning', 'Quality Gate CI workflow missing', 'This repo does not include the release gate workflow file.', 'Add .github/workflows/quality-gate.yml so pushes are audited automatically.'))
  }
  if (lowerNames.has('package-lock.json') && lowerNames.has('pnpm-lock.yaml')) {
    issues.push(makeIssue('repo', 'structure', 'warning', 'Multiple lockfiles found', 'More than one package manager lockfile was found.', 'Keep one lockfile strategy to avoid install drift.'))
  }
  if (files.length > 250) {
    issues.push(makeIssue('repo', 'performance', 'info', 'Large audit surface', 'This upload contains many files. The gate sampled the repo but you should still watch build speed.', 'Exclude dist, build, and coverage outputs from uploads.'))
  }

  const packageFiles = files.filter((file) => /(^|\/)package\.json$/.test(file.name))
  for (const pkg of packageFiles) {
    try {
      const parsed = JSON.parse(pkg.textPreview)
      const deps = Object.keys({ ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) })
      if (deps.length > 80) {
        issues.push(makeIssue(pkg.name, 'performance', 'warning', 'Large dependency surface', 'The package pulls in a wide dependency set, which can slow installs and audits.', 'Trim unused libraries and keep dependency count intentional.'))
      }
      if (!parsed.scripts?.build) {
        issues.push(makeIssue(pkg.name, 'release', 'warning', 'Build script missing', 'package.json does not expose a build script.', 'Add a build script so CI can verify production readiness.'))
      }
      if (!parsed.scripts?.lint) {
        issues.push(makeIssue(pkg.name, 'code', 'info', 'Lint script missing', 'A lint script was not found in package.json.', 'Add lint so code quality can be enforced automatically.'))
      }
      if (!parsed.scripts?.typecheck) {
        issues.push(makeIssue(pkg.name, 'code', 'info', 'Typecheck script missing', 'A typecheck script was not found in package.json.', 'Add typecheck so CI can catch regressions before build.'))
      }
    } catch {
      issues.push(makeIssue(pkg.name, 'structure', 'warning', 'package.json unreadable', 'The package.json file could not be parsed as JSON.', 'Fix invalid JSON so tooling can run.'))
    }
  }

  return issues
}

function buildFileReports(files: AnalyzedInputFile[], allIssues: AuditIssue[]): AuditedFile[] {
  return files.map((file) => {
    const fileIssues = allIssues.filter((issue) => issue.fileName === file.name)
    return {
      ...file,
      score: Math.max(20, 100 - penaltyFor(fileIssues)),
      status: 'complete',
      issues: fileIssues,
    }
  })
}

function buildReportFromFiles(files: AnalyzedInputFile[], rootPath?: string): AuditReport {
  const issues: AuditIssue[] = [...inspectRepo(files)]
  for (const file of files) issues.push(...inspectFile(file))

  const gates = GATES.map((gate) => buildGateResult(gate.key, issues.filter((issue) => issue.gate === gate.key)))
  const criticalIssues = issues.filter((issue) => issue.severity === 'critical').length
  const warnings = issues.filter((issue) => issue.severity === 'warning').length
  const overallScore = Math.round(gates.reduce((sum, gate) => sum + gate.score, 0) / Math.max(gates.length, 1))
  const repoDirectories = new Set(files.map((file) => path.dirname(file.name))).size

  return {
    summary: {
      overallScore,
      releaseStatus: criticalIssues > 0 ? 'blocked' : overallScore >= 90 ? 'ready' : 'needs work',
      criticalIssues,
      warnings,
      filesAudited: files.length,
      directoriesAudited: repoDirectories,
      ciReady: !issues.some((issue) => issue.gate === 'release' && /workflow/i.test(issue.title)),
    },
    gates,
    gateStatuses: applyGateResults(emptyGateStatuses(), {
      summary: {
        overallScore,
        releaseStatus: criticalIssues > 0 ? 'blocked' : overallScore >= 90 ? 'ready' : 'needs work',
        criticalIssues,
        warnings,
        filesAudited: files.length,
        directoriesAudited: repoDirectories,
        ciReady: !issues.some((issue) => issue.gate === 'release' && /workflow/i.test(issue.title)),
      },
      gates,
      issues,
      files: [],
      createdAt: new Date().toISOString(),
      rootPath,
    }),
    issues,
    files: buildFileReports(files, issues).sort((a, b) => a.score - b.score),
    createdAt: new Date().toISOString(),
    rootPath,
  }
}

async function collectAnalyzedFiles(rootDir: string): Promise<AnalyzedInputFile[]> {
  const fullFiles = await walkFiles(rootDir)
  const results: AnalyzedInputFile[] = []
  for (const fullPath of fullFiles.slice(0, MAX_FILES)) {
    const stat = await fs.stat(fullPath)
    results.push({
      id: fileId(relativeTo(rootDir, fullPath)),
      name: relativeTo(rootDir, fullPath),
      size: stat.size,
      type: isTextLikeFile(fullPath) ? 'text/plain' : 'application/octet-stream',
      textPreview: await readPreview(fullPath),
    })
  }
  return results
}

export async function createUpload(formData: FormData): Promise<UploadRecord> {
  await ensureRoot()
  const uploadId = crypto.randomUUID()
  const rootDir = path.join(ROOT, 'uploads', uploadId)
  await fs.mkdir(rootDir, { recursive: true })

  const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File)
  const saved: UploadedFileMeta[] = []
  const extractedRoots: string[] = []

  for (const file of files) {
    const relativePath = sanitizeRelativePath(file.name)
    const outPath = path.join(rootDir, relativePath)
    await writeFile(file, outPath)
    saved.push({
      originalName: file.name,
      storedPath: outPath,
      relativePath,
      size: file.size,
      type: file.type,
    })

    if (relativePath.toLowerCase().endsWith('.zip')) {
      const extractRoot = path.join(rootDir, '__unzipped__', path.basename(relativePath, '.zip'))
      const extracted = await tryUnzip(outPath, extractRoot)
      if (extracted) extractedRoots.push(extractRoot)
    }
  }

  const record: UploadRecord = {
    id: uploadId,
    rootDir,
    createdAt: new Date().toISOString(),
    files: saved,
    extractedRoots,
  }
  uploads.set(uploadId, record)
  return record
}

export function getUpload(uploadId: string) {
  return uploads.get(uploadId) || null
}

export function getRun(runId: string) {
  return runs.get(runId) || null
}

async function stageDelay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function createRun(uploadId: string): Promise<RunRecord> {
  const upload = uploads.get(uploadId)
  if (!upload) throw new Error('Upload not found')

  const run: RunRecord = {
    id: crypto.randomUUID(),
    uploadId,
    createdAt: new Date().toISOString(),
    status: 'queued',
    gateStatuses: emptyGateStatuses(),
    report: null,
    error: null,
  }
  runs.set(run.id, run)
  void executeRun(run.id)
  return run
}

async function executeRun(runId: string) {
  const run = runs.get(runId)
  if (!run) return
  const upload = uploads.get(run.uploadId)
  if (!upload) {
    run.status = 'failed'
    run.error = 'Upload not found'
    runs.set(runId, run)
    return
  }

  run.status = 'running'
  runs.set(runId, run)

  try {
    const auditRoots = upload.extractedRoots.length === 1 && upload.files.length === 1 && upload.files[0].relativePath.toLowerCase().endsWith('.zip') ? upload.extractedRoots : [upload.rootDir]
    let analyzedFiles: AnalyzedInputFile[] = []

    updateGate(run, 'structure', { stage: 'running' })
    await stageDelay(180)
    for (const auditRoot of auditRoots) {
      const files = await collectAnalyzedFiles(auditRoot)
      analyzedFiles = analyzedFiles.concat(files)
    }
    const structureIssues = inspectRepo(analyzedFiles).filter((issue) => issue.gate === 'structure')
    updateGate(run, 'structure', {
      stage: structureIssues.some((issue) => issue.severity === 'critical') ? 'failed' : 'passed',
      issues: structureIssues.length,
      score: Math.max(8, 100 - penaltyFor(structureIssues)),
    })

    const report = buildReportFromFiles(analyzedFiles, upload.rootDir)

    for (const gate of GATES.filter((entry) => entry.key !== 'structure')) {
      updateGate(run, gate.key, { stage: 'running' })
      await stageDelay(180)
      const result = report.gates.find((entry) => entry.key === gate.key)
      updateGate(run, gate.key, {
        stage: result?.passed ? 'passed' : 'failed',
        issues: result?.issues ?? 0,
        score: result?.score ?? null,
      })
    }

    report.gateStatuses = run.gateStatuses
    run.report = report
    run.status = 'completed'
    runs.set(runId, run)
  } catch (error) {
    run.status = 'failed'
    run.error = error instanceof Error ? error.message : 'Audit failed'
    runs.set(runId, run)
  }
}

export async function getRunReport(runId: string): Promise<AuditReport | null> {
  const run = runs.get(runId)
  return run?.report || null
}

export type RunStatusResponse = {
  id: string
  status: RunRecord['status']
  gateStatuses: GateStatus[]
  report: AuditReport | null
  error: string | null
}

export function getRunStatus(runId: string): RunStatusResponse | null {
  const run = runs.get(runId)
  if (!run) return null
  return {
    id: run.id,
    status: run.status,
    gateStatuses: run.gateStatuses,
    report: run.report,
    error: run.error,
  }
}
