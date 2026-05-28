import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'

// ── Config ────────────────────────────────────────────────────────────────────
function getGithubConfig() {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
  const installationId = process.env.GITHUB_INSTALLATION_ID

  if (!appId) throw new Error('GITHUB_APP_ID is not set')
  if (!privateKey) throw new Error('GITHUB_APP_PRIVATE_KEY is not set')
  if (!installationId) throw new Error('GITHUB_INSTALLATION_ID is not set')

  return {
    appId: Number(appId),
    privateKey: privateKey.replace(/\\n/g, '\n'),
    installationId: Number(installationId),
  }
}

// ── Authenticated Octokit client (auto-refreshes installation token) ──────────
export async function getOctokit(): Promise<Octokit> {
  const { appId, privateKey, installationId } = getGithubConfig()
  const auth = createAppAuth({ appId, privateKey, installationId })
  const { token } = await auth({ type: 'installation' })
  return new Octokit({ auth: token })
}

// ── File tree ─────────────────────────────────────────────────────────────────
export async function listRepoFiles(owner: string, repo: string, branch: string): Promise<string[]> {
  const octokit = await getOctokit()
  const { data } = await octokit.git.getTree({ owner, repo, tree_sha: branch, recursive: '1' })
  const EXCLUDED_DIRS = ['streamsai-builder-contract', 'node_modules', '.next', 'builder-batches', 'dist', '.git']
  const ALLOWED_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.md', '.sql', '.yaml', '.yml']
  const EXCLUDED_NAMES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'tsconfig.tsbuildinfo']

  return (data.tree ?? [])
    .filter(f => {
      if (f.type !== 'blob' || !f.path) return false
      const p = f.path
      if (EXCLUDED_DIRS.some(d => p.startsWith(d + '/'))) return false
      if (EXCLUDED_NAMES.some(n => p === n || p.endsWith('/' + n))) return false
      if (!ALLOWED_EXTS.some(ext => p.endsWith(ext))) return false
      return true
    })
    .map(f => f.path!)
    .sort()
}

// ── Read file ─────────────────────────────────────────────────────────────────
export async function readRepoFile(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<{ path: string; sha: string; content: string }> {
  const octokit = await getOctokit()
  const { data } = await octokit.repos.getContent({ owner, repo, path, ref: branch })
  if (Array.isArray(data) || data.type !== 'file') throw new Error(`${path} is not a file`)
  return {
    path,
    sha: data.sha,
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
  }
}

// ── Write file ────────────────────────────────────────────────────────────────
export async function writeRepoFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<unknown> {
  const octokit = await getOctokit()
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch,
    ...(sha ? { sha } : {}),
  })
  return data
}

// ── Create branch ─────────────────────────────────────────────────────────────
export async function createBranch(owner: string, repo: string, branch: string, fromBranch = 'main'): Promise<void> {
  const octokit = await getOctokit()
  const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${fromBranch}` })
  await octokit.git.createRef({ owner, repo, ref: `refs/heads/${branch}`, sha: ref.object.sha })
}

// ── Open PR ───────────────────────────────────────────────────────────────────
export async function openPullRequest(
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base = 'main'
): Promise<string> {
  const octokit = await getOctokit()
  const { data } = await octokit.pulls.create({ owner, repo, title, body, head, base })
  return data.html_url
}

// ── Connection status ─────────────────────────────────────────────────────────
export async function getConnectionStatus(): Promise<{ connected: boolean; appId: number; installationId: number; error?: string }> {
  try {
    const { appId, installationId } = getGithubConfig()
    const octokit = await getOctokit()
    await octokit.apps.listReposAccessibleToInstallation({ per_page: 1 })
    return { connected: true, appId, installationId }
  } catch (err) {
    return {
      connected: false,
      appId: Number(process.env.GITHUB_APP_ID ?? 0),
      installationId: Number(process.env.GITHUB_INSTALLATION_ID ?? 0),
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
