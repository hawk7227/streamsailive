import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { affectedFiles, buildRepositoryGraph, planSymbolReplacement, searchRepositoryGraph } from "@/lib/streams-builder/repository-graph";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "streams-repository-graph-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { build: "next build", test: "vitest" } }));
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({ references: [{ path: "./packages/core" }] }));
  await writeFile(join(root, "src", "math.ts"), "export function add(left: number, right: number) { return left + right; }\n");
  await writeFile(join(root, "src", "page.ts"), "import { add } from './math';\nexport const total = add(1, 2);\n");
  return root;
}

describe("repository graph", () => {
  it("builds file, symbol, dependency, build, and semantic indexes", async () => {
    const graph = await buildRepositoryGraph(await fixture());
    expect(graph.files.map((file) => file.path)).toContain("src/math.ts");
    expect(graph.symbols.some((symbol) => symbol.name === "add" && symbol.exported)).toBe(true);
    expect(graph.dependencies).toContainEqual(expect.objectContaining({ from: "src/page.ts", specifier: "./math", kind: "import" }));
    expect(graph.build).toContainEqual(expect.objectContaining({ id: "package.json#build", command: "next build" }));
    expect(graph.build).toContainEqual(expect.objectContaining({ id: "tsconfig.json", dependsOn: ["./packages/core"] }));
    expect(searchRepositoryGraph(graph, "add math")[0]?.path).toBe("src/math.ts");
  });

  it("creates a minimal symbol-bounded replacement instead of rewriting the file", async () => {
    const root = await fixture();
    const graph = await buildRepositoryGraph(root);
    const sourceText = await readFile(join(root, "src", "math.ts"), "utf8");
    const patch = planSymbolReplacement({
      graph,
      file: "src/math.ts",
      symbolName: "add",
      sourceText,
      replacement: "export function add(left: number, right: number) { return Math.trunc(left + right); }",
    });
    expect(patch.before).toContain("function add");
    expect(patch.result).toContain("Math.trunc");
    expect(patch.result.split("\n")).toHaveLength(sourceText.split("\n").length);
  });

  it("expands changed files to direct reverse dependents", async () => {
    const graph = await buildRepositoryGraph(await fixture());
    graph.dependencies = graph.dependencies.map((edge) => edge.specifier === "./math" ? { ...edge, to: "src/math.ts", resolved: true } : edge);
    expect(affectedFiles(graph, ["src/math.ts"])).toEqual(["src/math.ts", "src/page.ts"]);
  });
});
