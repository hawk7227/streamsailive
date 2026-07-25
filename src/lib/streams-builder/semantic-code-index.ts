import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { RepositoryGraph, RepositorySymbolNode } from "./repository-graph";

export interface SemanticIndexChunk {
  id: string;
  file: string;
  symbolId?: string;
  symbolName?: string;
  kind: "file" | "symbol";
  contentHash: string;
  terms: Record<string, number>;
  dependencies: string[];
}

export interface PersistentSemanticIndex {
  version: 1;
  repositoryRoot: string;
  graphDigest: string;
  generatedAt: string;
  chunks: Record<string, SemanticIndexChunk>;
  documentFrequency: Record<string, number>;
  fileHashes: Record<string, string>;
}

export interface SemanticSearchResult {
  chunkId: string;
  file: string;
  symbolId?: string;
  symbolName?: string;
  score: number;
  reasons: string[];
}

const TOKEN_PATTERN = /[A-Za-z_$][A-Za-z0-9_$]{1,}/g;
function tokenize(value: string): string[] {
  return (value.match(TOKEN_PATTERN) ?? []).map((token) => token.toLowerCase());
}
function frequencies(value: string) {
  const terms: Record<string, number> = {};
  for (const token of tokenize(value)) terms[token] = (terms[token] ?? 0) + 1;
  return terms;
}
function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function symbolChunk(symbol: RepositorySymbolNode, sourceText: string, dependencies: string[]): SemanticIndexChunk {
  const content = sourceText.slice(symbol.start, symbol.end);
  return {
    id: `symbol:${symbol.id}`,
    file: symbol.file,
    symbolId: symbol.id,
    symbolName: symbol.name,
    kind: "symbol",
    contentHash: createHash("sha256").update(content).digest("hex"),
    terms: frequencies(`${symbol.name} ${symbol.kind} ${symbol.file} ${content}`),
    dependencies,
  };
}

export async function buildIncrementalSemanticIndex(input: {
  graph: RepositoryGraph;
  readSource: (file: string) => Promise<string>;
  previous?: PersistentSemanticIndex | null;
}): Promise<{ index: PersistentSemanticIndex; reusedChunks: number; rebuiltChunks: number }> {
  const chunks: Record<string, SemanticIndexChunk> = {};
  const fileHashes = Object.fromEntries(input.graph.files.map((file) => [file.path, file.sha256]));
  let reusedChunks = 0;
  let rebuiltChunks = 0;
  const dependencyMap = new Map<string, string[]>();
  for (const edge of input.graph.dependencies) {
    const list = dependencyMap.get(edge.from) ?? [];
    list.push(edge.to);
    dependencyMap.set(edge.from, list);
  }

  for (const file of input.graph.files) {
    const previousFileChunk = input.previous?.chunks[`file:${file.path}`];
    if (input.previous?.fileHashes[file.path] === file.sha256 && previousFileChunk) {
      chunks[previousFileChunk.id] = previousFileChunk;
      for (const old of Object.values(input.previous.chunks)) {
        if (old.file === file.path && old.kind === "symbol") chunks[old.id] = old;
      }
      reusedChunks += 1 + Object.values(input.previous.chunks).filter((old) => old.file === file.path && old.kind === "symbol").length;
      continue;
    }

    const source = await input.readSource(file.path);
    const deps = [...new Set(dependencyMap.get(file.path) ?? [])].sort();
    const fileChunk: SemanticIndexChunk = {
      id: `file:${file.path}`,
      file: file.path,
      kind: "file",
      contentHash: file.sha256,
      terms: frequencies(`${file.path} ${source}`),
      dependencies: deps,
    };
    chunks[fileChunk.id] = fileChunk;
    rebuiltChunks += 1;
    for (const symbol of input.graph.symbols.filter((item) => item.file === file.path)) {
      const chunk = symbolChunk(symbol, source, deps);
      chunks[chunk.id] = chunk;
      rebuiltChunks += 1;
    }
  }

  const documentFrequency: Record<string, number> = {};
  for (const chunk of Object.values(chunks)) {
    for (const term of Object.keys(chunk.terms)) documentFrequency[term] = (documentFrequency[term] ?? 0) + 1;
  }
  const graphDigest = digest({ files: fileHashes, symbols: input.graph.symbols.map((s) => s.id), dependencies: input.graph.dependencies });
  return {
    index: { version: 1, repositoryRoot: input.graph.root, graphDigest, generatedAt: new Date().toISOString(), chunks, documentFrequency, fileHashes },
    reusedChunks,
    rebuiltChunks,
  };
}

export function searchSemanticIndex(index: PersistentSemanticIndex, query: string, limit = 20): SemanticSearchResult[] {
  const queryTerms = [...new Set(tokenize(query))];
  const count = Math.max(1, Object.keys(index.chunks).length);
  const results: SemanticSearchResult[] = [];
  for (const chunk of Object.values(index.chunks)) {
    let score = 0;
    const reasons: string[] = [];
    for (const term of queryTerms) {
      const tf = chunk.terms[term] ?? 0;
      if (!tf) continue;
      const idf = Math.log((count + 1) / ((index.documentFrequency[term] ?? 0) + 1)) + 1;
      const contribution = (1 + Math.log(tf)) * idf;
      score += contribution;
      reasons.push(`${term}:${contribution.toFixed(2)}`);
      if (chunk.symbolName?.toLowerCase() === term) score += 5;
    }
    if (score > 0) results.push({ chunkId: chunk.id, file: chunk.file, symbolId: chunk.symbolId, symbolName: chunk.symbolName, score, reasons });
  }
  return results.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file)).slice(0, Math.max(1, limit));
}

export class FileSemanticIndexStore {
  constructor(private readonly path = process.env.STREAMS_SEMANTIC_INDEX_PATH || "/tmp/streams-runtime-store/semantic-index.json") {}
  async read(): Promise<PersistentSemanticIndex | null> {
    try { return JSON.parse(await readFile(resolve(this.path), "utf8")) as PersistentSemanticIndex; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }
  async write(index: PersistentSemanticIndex) {
    const target = resolve(this.path);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporary, JSON.stringify(index), "utf8");
    await rename(temporary, target);
  }
}
