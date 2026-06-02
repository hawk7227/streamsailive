const fs = require("fs");

const checks = [
  ["materialized timeline model", "src/lib/admingeneration/editor/materialized-timeline.ts", "buildMaterializedTimeline"],
  ["materialized timeline route", "src/app/api/admingeneration/editor/projects/[id]/materialized-timeline/route.ts", "buildMaterializedTimeline"],
  ["frontend materialized timeline state", "src/components/admingeneration/FullOutputEditorClient.jsx", "materializedTimeline"],
  ["frontend materialized route load", "src/components/admingeneration/FullOutputEditorClient.jsx", "materialized-timeline"],
];

let failed = false;
console.log("=================================================");
console.log("MATERIALIZED TIMELINE AUDIT");
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

if (failed) process.exit(1);
console.log("RESULT: PASS");
