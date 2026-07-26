export type DiscoveryRepo = { id: number; fullName: string; defaultBranch: string };
export type DiscoveryFile = { path: string; sha: string; directory?: string; name?: string };

export type DiscoveryContext = {
  prompt: string;
  conversation?: string[];
  screenshotText?: string;
  visibleText?: string;
  route?: string;
  currentRepo?: string;
  currentBranch?: string;
  recentFiles?: string[];
};

export type DiscoveryCandidate = {
  repo: string;
  branch: string;
  file: DiscoveryFile;
  score: number;
  reasons: string[];
};

const STOP = new Set(["the", "a", "an", "to", "for", "of", "in", "on", "this", "that", "it", "file", "open", "pull", "show", "find", "locate", "github", "repo", "repository", "screen", "page"]);
const SYNONYMS: Record<string, string[]> = {
  builder: ["builder", "workstation", "canvas", "editor"],
  frontend: ["frontend", "ui", "view", "visual", "component", "page"],
  backend: ["backend", "api", "route", "server", "service"],
  chat: ["chat", "conversation", "message", "composer"],
  toolbar: ["toolbar", "controls", "header", "nav"],
  preview: ["preview", "render", "iframe", "browser"],
  login: ["login", "signin", "auth", "session"],
  home: ["home", "homepage", "landing", "index"],
};

function words(value: string) {
  return value.toLowerCase().replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[^a-z0-9]+/).filter((word) => word.length > 1 && !STOP.has(word));
}

function expand(tokens: string[]) {
  const result = new Set(tokens);
  for (const token of tokens) {
    for (const [key, values] of Object.entries(SYNONYMS)) {
      if (token === key || values.includes(token)) {
        result.add(key);
        values.forEach((value) => result.add(value));
      }
    }
  }
  return [...result];
}

function pathTokens(path: string) {
  return words(path.replace(/\.(tsx?|jsx?|html?|css|scss|json|md)$/i, ""));
}

function kindScore(path: string, promptTokens: Set<string>) {
  const lower = path.toLowerCase();
  let score = 0;
  if ((promptTokens.has("frontend") || promptTokens.has("ui") || promptTokens.has("visual")) && /\.(tsx|jsx|html)$/.test(lower)) score += 18;
  if ((promptTokens.has("backend") || promptTokens.has("api") || promptTokens.has("server")) && /(api|server|route|service)/.test(lower)) score += 18;
  if ((promptTokens.has("page") || promptTokens.has("screen") || promptTokens.has("route")) && /(?:^|\/)(page|route)\.(tsx?|jsx?)$/.test(lower)) score += 15;
  if (promptTokens.has("component") && /(components?|ui)\//.test(lower)) score += 12;
  if (/(node_modules|\.next|dist|build|coverage|generated)\//.test(lower)) score -= 40;
  if (/\.test\.|\.spec\./.test(lower) && !promptTokens.has("test")) score -= 12;
  return score;
}

export function createDiscoverySignals(context: DiscoveryContext) {
  const sources = [context.prompt, ...(context.conversation || []).slice(-12), context.screenshotText || "", context.visibleText || "", context.route || "", ...(context.recentFiles || []).slice(-12)];
  const weighted = new Map<string, number>();
  sources.forEach((source, index) => {
    const weight = index === 0 ? 8 : index <= 12 ? 3 : 5;
    for (const token of expand(words(source))) weighted.set(token, Math.max(weighted.get(token) || 0, weight));
  });
  return weighted;
}

export function rankDiscoveryCandidates(repos: DiscoveryRepo[], filesByRepo: Record<string, DiscoveryFile[]>, context: DiscoveryContext) {
  const signals = createDiscoverySignals(context);
  const promptTokens = new Set(expand(words(context.prompt)));
  const candidates: DiscoveryCandidate[] = [];

  for (const repo of repos) {
    const branch = context.currentRepo === repo.fullName && context.currentBranch ? context.currentBranch : repo.defaultBranch || "main";
    for (const file of filesByRepo[repo.fullName] || []) {
      const tokens = pathTokens(file.path);
      let score = kindScore(file.path, promptTokens);
      const reasons: string[] = [];
      for (const token of tokens) {
        const weight = signals.get(token);
        if (weight) { score += weight; reasons.push(`matched ${token}`); }
      }
      const normalizedPath = file.path.toLowerCase();
      for (const recent of context.recentFiles || []) {
        if (recent === file.path) { score += 22; reasons.push("recently opened"); }
        else if (recent.split("/").slice(0, -1).join("/") && normalizedPath.startsWith(recent.split("/").slice(0, -1).join("/").toLowerCase())) score += 4;
      }
      if (context.currentRepo === repo.fullName) { score += 10; reasons.push("current repository"); }
      if (context.route) {
        const routeTokens = pathTokens(context.route);
        const overlap = routeTokens.filter((token) => tokens.includes(token)).length;
        if (overlap) { score += overlap * 7; reasons.push("route evidence"); }
      }
      if (score > 0) candidates.push({ repo: repo.fullName, branch, file, score, reasons: [...new Set(reasons)].slice(0, 6) });
    }
  }

  return candidates.sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path));
}

export function isFileConfirmation(prompt: string) {
  return /^(yes|correct|that(?:'s| is) (?:it|the one)|this is it|lock it|lock this|work on this|use this file|confirmed|right file)\b/i.test(prompt.trim());
}

export function isScopeExpansionGrant(prompt: string) {
  return /^(yes|approved|grant|allow|open it|pull it|you may|go ahead|do it)\b/i.test(prompt.trim());
}
