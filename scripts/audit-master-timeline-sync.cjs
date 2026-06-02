const fs = require("fs");

const checks = [
  ["master sync model", "src/lib/admingeneration/editor/master-timeline-sync.ts", "buildMasterTimelineSync"],
  ["semantic sync route", "src/app/api/admingeneration/editor/projects/[id]/semantic-sync/route.ts", "buildMasterTimelineSync"],
  ["semantic action route", "src/app/api/admingeneration/editor/projects/[id]/semantic-action/route.ts", "resolveSemanticEditPlan"],
  ["semantic edit contract", "src/lib/admingeneration/editor/semantic-edit-contract.ts", "SEMANTIC_EDIT_ACTIONS"],
];

let failed = false;

console.log("=================================================");
console.log("MASTER TIMELINE SYNC AUDIT");
console.log("=================================================");

for (const [label, file, needle] of checks) {
  if (!fs.existsSync(file)) {
    console.log(`❌ ${label}: missing file ${file}`);
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
