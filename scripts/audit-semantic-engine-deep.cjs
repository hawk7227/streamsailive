const fs = require("fs");

const checks = [
  ["semantic contract", "src/lib/admingeneration/editor/semantic-edit-contract.ts", "SEMANTIC_EDIT_ACTIONS"],
  ["semantic-action route", "src/app/api/admingeneration/editor/projects/[id]/semantic-action/route.ts", "resolveSemanticEditPlan"],
  ["frontend semantic action helper", "src/components/admingeneration/FullOutputEditorClient.jsx", "runSemanticAction"],
  ["full video flag", "src/components/admingeneration/FullOutputEditorClient.jsx", "fullVideoRegeneration"],
  ["preserve original flag", "src/components/admingeneration/FullOutputEditorClient.jsx", "preserveOriginal"],
  ["selected segment CTA", "src/components/admingeneration/FullOutputEditorClient.jsx", "Regenerate Selected Segment"],
  ["separate full video CTA", "src/components/admingeneration/FullOutputEditorClient.jsx", "Regenerate Entire Video"],
  ["semantic-action frontend call", "src/components/admingeneration/FullOutputEditorClient.jsx", "/semantic-action"],
];

let failed = false;

console.log("=================================================");
console.log("DEEP SEMANTIC EDIT ENGINE AUDIT");
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
