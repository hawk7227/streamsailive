import fs from "node:fs/promises";
import path from "node:path";

const categories = [
  "factual", "reasoning", "writing", "rewriting", "summarization", "coding", "debugging", "architecture", "image", "screenshot",
  "pdf", "spreadsheet", "long-context", "memory", "research", "exact-format", "tools", "actions", "corrections", "safety",
];
const variants = [
  "minimal direct answer", "standard answer", "detailed comparison", "exhaustive non-condensed answer", "exact JSON", "exact Markdown table",
  "numbered headings", "current-source citations", "uncertainty required", "no generic closing",
];

export function buildBenchmarkCases() {
  const cases = [];
  for (let index = 0; index < 1000; index += 1) {
    const category = categories[index % categories.length];
    const variant = variants[Math.floor(index / categories.length) % variants.length];
    cases.push({
      id: `streams-parity-${String(index + 1).padStart(4, "0")}`,
      category,
      variant,
      prompt: `Benchmark ${index + 1}: Handle this ${category} request as a ${variant}. Follow the user's exact instruction, avoid unsupported claims, and preserve requested structure.`,
      thresholds: { semantic: 0.95, coverage: 0.95, instruction: 0.98, structure: 0.92, style: 0.9 },
    });
  }
  return cases;
}

async function main() {
  const cases = buildBenchmarkCases();
  const output = path.resolve(process.cwd(), "artifacts/streams-ai-parity-benchmark.json");
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify({ version: "streams-parity-benchmark-v1", count: cases.length, cases }, null, 2));
  console.log(`[streams-parity] wrote ${cases.length} cases to ${output}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error); process.exit(1); });
