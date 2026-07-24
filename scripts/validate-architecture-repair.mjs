import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const required = [
  "src/lib/streams-ai/runtime/architecture/contracts.ts",
  "src/lib/streams-ai/runtime/architecture/capability-registry.ts",
  "src/lib/streams-ai/runtime/architecture/product-intent-router.ts",
  "src/lib/streams-ai/runtime/architecture/operation-repository.ts",
  "src/lib/streams-ai/runtime/architecture/execution-truth-validator.ts",
  "src/lib/streams-ai/runtime/architecture/state-machine.ts",
  "src/lib/streams-ai/runtime/architecture/timeout-policy.ts",
  "src/lib/streams-ai/runtime/architecture/tool-policy.ts",
  "src/lib/streams-ai/runtime/architecture/context-assembler.ts",
  "src/lib/streams-ai/runtime/architecture/failure-taxonomy.ts",
  "src/lib/streams-ai/runtime/architecture/response-claims.ts",
  "src/lib/streams-ai/runtime/architecture/retry-policy.ts",
  "src/components/streams-ai/current-chat/runtime/streamsDurableConversationBuffer.js",
  "src/lib/streams-builder/chat-builder-executor.ts",
  "src/app/api/streams-ai/messages/route.ts",
  "src/app/api/streams-ai/capabilities/route.ts",
  "src/app/api/streams-ai/operations/[operationId]/route.ts",
  "supabase/migrations/20260724000100_streams_ai_authoritative_operations.sql",
  "supabase/migrations/20260724000200_streams_ai_complete_runtime_foundation.sql",
  "tests/architecture/product-intent-router.test.ts",
  "tests/architecture/execution-truth-validator.test.ts",
  "tests/architecture/runtime-foundation.test.ts",
];

const errors = [];
const sourceFiles = [];
for (const relative of required) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    errors.push(`Missing required architecture file: ${relative}`);
    continue;
  }
  if (/\.(?:ts|tsx)$/.test(relative)) sourceFiles.push(relative);
}

function resolveInternalImport(fromFile, specifier) {
  const base = specifier.startsWith("@/")
    ? path.join(root, "src", specifier.slice(2))
    : path.resolve(path.dirname(path.join(root, fromFile)), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js"),
  ];
  return candidates.some((candidate) => fs.existsSync(candidate));
}

for (const relative of sourceFiles) {
  const absolute = path.join(root, relative);
  const source = fs.readFileSync(absolute, "utf8");
  const importPattern = /(?:from\s+|import\s*\()(["'])([^"']+)\1/g;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[2];
    if ((specifier.startsWith(".") || specifier.startsWith("@/")) && !resolveInternalImport(relative, specifier)) {
      errors.push(`${relative}: unresolved internal import ${specifier}`);
    }
  }
}

const route = fs.readFileSync(path.join(root, "src/app/api/streams-ai/messages/route.ts"), "utf8");
for (const marker of ["routeProductIntent", "executeWebsiteBuild", 'emit(controller, "artifact"', "executionVerified: true"]) {
  if (!route.includes(marker)) errors.push(`Messages route is missing required integration marker: ${marker}`);
}
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260724000100_streams_ai_authoritative_operations.sql"), "utf8");
for (const table of ["streams_ai_operations", "streams_ai_operation_events"]) {
  if (!migration.includes(table)) errors.push(`Operation migration is missing ${table}`);
}

const migration2 = fs.readFileSync(path.join(root, "supabase/migrations/20260724000200_streams_ai_complete_runtime_foundation.sql"), "utf8");
for (const table of ["streams_ai_conversation_events", "streams_ai_operation_snapshots", "streams_ai_idempotency_records"]) {
  if (!migration2.includes(table)) errors.push(`Complete runtime migration is missing ${table}`);
}

if (errors.length) {
  console.error("Architecture repair validation failed:\n" + errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log(`Architecture repair validation passed (${required.length} required files, ${sourceFiles.length} TypeScript files).`);
