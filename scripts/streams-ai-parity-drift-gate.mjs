import fs from "node:fs/promises";
import path from "node:path";

const latestPath = process.env.STREAMS_PARITY_LATEST || "artifacts/streams-ai-parity-latest.json";
const baselinePath = process.env.STREAMS_PARITY_BASELINE || "artifacts/streams-ai-parity-baseline.json";
const tolerance = Number(process.env.STREAMS_PARITY_DRIFT_TOLERANCE || 0.01);

async function readJson(file) {
  return JSON.parse(await fs.readFile(path.resolve(process.cwd(), file), "utf8"));
}

function score(report, key) {
  const value = Number(report?.metrics?.[key]);
  if (!Number.isFinite(value)) throw new Error(`Missing parity metric: ${key}`);
  return value;
}

async function main() {
  const [latest, baseline] = await Promise.all([readJson(latestPath), readJson(baselinePath)]);
  const required = ["semantic", "coverage", "instruction", "structure", "style"];
  const failures = [];
  for (const key of required) {
    const delta = score(latest, key) - score(baseline, key);
    if (delta < -tolerance) failures.push(`${key} regressed by ${Math.abs(delta).toFixed(4)}`);
  }
  const criticalFailures = Number(latest?.criticalFailures || 0);
  if (criticalFailures > 0) failures.push(`${criticalFailures} critical failures`);
  if (failures.length) {
    console.error(`[streams-parity] release blocked: ${failures.join("; ")}`);
    process.exit(1);
  }
  console.log("[streams-parity] release gate passed");
}

main().catch((error) => { console.error(error); process.exit(1); });
