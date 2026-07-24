import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import ts from "typescript";

export type RepositoryFileNode = {
  path: string;
  sha256: string;
  bytes: number;
  language: string;
  tokens: string[];
};

export type RepositorySymbolNode = {
  id: string;
  name: string;
  kind: string;
  file: string;
  start: number;
  end: number;
  exported: boolean;
};

export type RepositoryDependencyEdge = {
  from: string;
  to: string;
  specifier: string;
  kind: "import" | "export" | "require" | "dynamic-import" | "project-reference";
  resolved: boolean;
};

export type RepositoryBuildNode = {
  id: string;
  kind: "package-script" | "workspace" | "tsconfig";
  file: string;
  command?: string;
  dependsOn: string[];
};

export type RepositoryGraph = {
  root: string;
  generatedAt: string;
  files: RepositoryFileNode[];
  symbols: RepositorySymbolNode[];
  dependencies: RepositoryDependencyEdge[];
  build: RepositoryBuildNode[];
  invertedIndex: Record<string, string[]>;
};

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"]);
const IGNORED_DIRECTORIES = new Set([".git", ".next", "node_modules", "dist", "build", "coverage", ".turbo"]);

function tokenize(value: string) {
  return [...new Set(value.toLowerCase().match(/[a-z_][a-z0-9_]{2,}/g) ?? [])].slice(0, 4096);
}

function languageFor(path: string) {
  const extension = extname(path).slice(1);
  return extension || "text";
}

async function walk(root: string, current = root, output: string[] = []): Promise<string[]> {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const absolute = join(current, entry.name);
    if (entry.isDirectory()) await walk(root, absolute, output);
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

function scriptKind(path: string): ts.ScriptKind {
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (path.endsWith(".js") || path.endsWith(".mjs") || path.endsWith(".cjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function declarationName(node: ts.Node): string | null {
  const named = node as ts.NamedDeclaration;
  return named.name && ts.isIdentifier(named.name) ? named.name.text : null;
}

function isExported(node: ts.Node) {
  return Boolean(ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export);
}

function extractSourceGraph(file: string, text: string, root: string) {
  const relativeFile = relative(root, file).replaceAll("\\", "/");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  const symbols: RepositorySymbolNode[] = [];
  const dependencies: RepositoryDependencyEdge[] = [];

  const addDependency = (specifier: string, kind: RepositoryDependencyEdge["kind"]) => {
    dependencies.push({ from: relativeFile, to: specifier, specifier, kind, resolved: !specifier.startsWith(".") });
  };

  const visit = (node: ts.Node) => {
    const name = declarationName(node);
    if (name && (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || ts.isVariableDeclaration(node) || ts.isMethodDeclaration(node))) {
      symbols.push({
        id: `${relativeFile}:${node.getStart(source)}:${name}`,
        name,
        kind: ts.SyntaxKind[node.kind],
        file: relativeFile,
        start: node.getStart(source),
        end: node.getEnd(),
        exported: isExported(node.parent && ts.isVariableDeclaration(node) ? node.parent.parent.parent : node),
      });
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) addDependency(node.moduleSpecifier.text, "import");
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) addDependency(node.moduleSpecifier.text, "export");
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) addDependency(node.arguments[0].text, "dynamic-import");
      else if (ts.isIdentifier(node.expression) && node.expression.text === "require") addDependency(node.arguments[0].text, "require");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { symbols, dependencies };
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function buildNodes(root: string, files: string[]) {
  const nodes: RepositoryBuildNode[] = [];
  for (const absolute of files) {
    const file = relative(root, absolute).replaceAll("\\", "/");
    if (file.endsWith("package.json")) {
      const json = await readJson(absolute);
      const scripts = json?.scripts && typeof json.scripts === "object" ? json.scripts as Record<string, unknown> : {};
      for (const [name, command] of Object.entries(scripts)) {
        if (typeof command === "string") nodes.push({ id: `${file}#${name}`, kind: "package-script", file, command, dependsOn: [] });
      }
      const workspaces = Array.isArray(json?.workspaces) ? json?.workspaces as string[] : [];
      if (workspaces.length) nodes.push({ id: `${file}#workspaces`, kind: "workspace", file, dependsOn: workspaces });
    }
    if (/tsconfig(?:\.[^/]+)?\.json$/.test(file)) {
      const json = await readJson(absolute);
      const refs = Array.isArray(json?.references) ? (json?.references as Array<{ path?: unknown }>).map((item) => String(item.path ?? "")).filter(Boolean) : [];
      nodes.push({ id: file, kind: "tsconfig", file, dependsOn: refs });
    }
  }
  return nodes;
}

export async function buildRepositoryGraph(rootInput: string): Promise<RepositoryGraph> {
  const root = resolve(rootInput);
  const absoluteFiles = await walk(root);
  const files: RepositoryFileNode[] = [];
  const symbols: RepositorySymbolNode[] = [];
  const dependencies: RepositoryDependencyEdge[] = [];
  const inverted = new Map<string, Set<string>>();

  for (const absolute of absoluteFiles) {
    const info = await stat(absolute);
    if (info.size > 2_000_000) continue;
    const text = await readFile(absolute, "utf8").catch(() => "");
    const path = relative(root, absolute).replaceAll("\\", "/");
    const tokens = tokenize(`${path} ${text}`);
    files.push({ path, sha256: createHash("sha256").update(text).digest("hex"), bytes: info.size, language: languageFor(path), tokens });
    for (const token of tokens) {
      const bucket = inverted.get(token) ?? new Set<string>();
      bucket.add(path);
      inverted.set(token, bucket);
    }
    if (SOURCE_EXTENSIONS.has(extname(path))) {
      const extracted = extractSourceGraph(absolute, text, root);
      symbols.push(...extracted.symbols);
      dependencies.push(...extracted.dependencies);
    }
  }

  return {
    root,
    generatedAt: new Date().toISOString(),
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    symbols: symbols.sort((a, b) => a.file.localeCompare(b.file) || a.start - b.start),
    dependencies,
    build: await buildNodes(root, absoluteFiles),
    invertedIndex: Object.fromEntries([...inverted.entries()].map(([token, paths]) => [token, [...paths].sort()])),
  };
}

export function searchRepositoryGraph(graph: RepositoryGraph, query: string, limit = 20) {
  const queryTokens = tokenize(query);
  const scores = new Map<string, number>();
  for (const token of queryTokens) {
    for (const path of graph.invertedIndex[token] ?? []) scores.set(path, (scores.get(path) ?? 0) + 1);
    for (const symbol of graph.symbols) {
      if (symbol.name.toLowerCase().includes(token)) scores.set(symbol.file, (scores.get(symbol.file) ?? 0) + 3);
    }
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, Math.max(1, limit)).map(([path, score]) => ({ path, score }));
}

export function affectedFiles(graph: RepositoryGraph, changedFiles: string[]) {
  const changed = new Set(changedFiles);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const edge of graph.dependencies) {
      if (changed.has(edge.to) && !changed.has(edge.from)) {
        changed.add(edge.from);
        expanded = true;
      }
    }
  }
  return [...changed].sort();
}

export function planSymbolReplacement(input: { graph: RepositoryGraph; symbolName: string; replacement: string; sourceText: string; file: string }) {
  const matches = input.graph.symbols.filter((symbol) => symbol.name === input.symbolName && symbol.file === input.file);
  if (matches.length !== 1) throw new Error(`Expected exactly one symbol ${input.symbolName} in ${input.file}; found ${matches.length}.`);
  const symbol = matches[0];
  return {
    file: input.file,
    start: symbol.start,
    end: symbol.end,
    before: input.sourceText.slice(symbol.start, symbol.end),
    after: input.replacement,
    result: `${input.sourceText.slice(0, symbol.start)}${input.replacement}${input.sourceText.slice(symbol.end)}`,
  };
}
