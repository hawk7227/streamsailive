const fs = require("fs");

const checks = [
  ["QA activation gate model", "src/lib/admingeneration/editor/qa-activation-gate.ts", "evaluateQaActivationGate"],
  ["QA activation gate route", "src/app/api/admingeneration/editor/projects/[id]/activation-gate/route.ts", "evaluateQaActivationGate"],
  ["Version graph model", "src/lib/admingeneration/editor/version-graph.ts", "buildVersionGraph"],
  ["Version graph route", "src/app/api/admingeneration/editor/projects/[id]/version-graph/route.ts", "buildVersionGraph"],
  ["Export proof model", "src/lib/admingeneration/editor/export-proof.ts", "evaluateExportProof"],
  ["Export proof route", "src/app/api/admingeneration/editor/projects/[id]/export-proof/route.ts", "evaluateExportProof"],
  ["Provider readiness model", "src/lib/admingeneration/editor/provider-readiness.ts", "getProviderReadiness"],
  ["Provider readiness route", "src/app/api/admingeneration/editor/projects/[id]/readiness/route.ts", "getProviderReadiness"],
  ["Semantic edit contract", "src/lib/admingeneration/editor/semantic-edit-contract.ts", "SEMANTIC_EDIT_ACTIONS"],
  ["Semantic action router", "src/app/api/admingeneration/editor/projects/[id]/semantic-action/route.ts", "resolveSemanticEditPlan"],
  ["Master timeline sync", "src/lib/admingeneration/editor/master-timeline-sync.ts", "buildMasterTimelineSync"],
];

let failed = false;

console.log("=================================================");
console.log("EDITOR PRODUCTION LAYERS AUDIT");
console.log("=================================================");

for (const [label, file, needle] of checks) {
  if (!fs.existsSync(file)) {
    console.log(`❌ ${label}: missing ${file}`);
    failed = true;
    continue;
  }

  const text = fs.readFileSync(file, "utf8");
  if (!text.includes(needle)) {
    console.log(`❌ ${label}: missing ${needle}`);
    failed = true;
  } else {
    console.log(`✅ ${label}`);
  }
}

console.log("=================================================");
if (failed) {
  console.log("RESULT: FAIL");
  process.exit(1);
}

console.log("RESULT: PASS");
