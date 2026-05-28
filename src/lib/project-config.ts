export type ActiveProject = {
  id: string
  name: string
  owner: string
  repo: string
  branch: string
  currentFile: string
  previewTarget: string
}

export const DEFAULT_PROJECT: ActiveProject = {
  id: 'streamsai-editor',
  name: 'streamsai-editor',
  owner: 'hawk7227',
  repo: 'streamsai-editor',
  branch: 'main',
  currentFile: 'apps/web/src/app/studio/page.tsx',
  previewTarget: '/preview',
}

const KEY = 'streamsai:active-project'
export function loadActiveProject(): ActiveProject {
  if (typeof window === 'undefined') return DEFAULT_PROJECT
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_PROJECT, ...JSON.parse(raw) } : DEFAULT_PROJECT
  } catch {
    return DEFAULT_PROJECT
  }
}
export function saveActiveProject(project: ActiveProject) {
  if (typeof window !== 'undefined') window.localStorage.setItem(KEY, JSON.stringify(project))
}
