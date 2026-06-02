const fs = require("fs");

const checks = [
  ["word speaker map", "src/lib/admingeneration/editor/word-speaker-map.ts", "buildWordSpeakerMap"],
  ["word speaker route", "src/app/api/admingeneration/editor/projects/[id]/word-speaker-map/route.ts", "buildWordSpeakerMap"],
  ["subject motion binding", "src/lib/admingeneration/editor/subject-motion-binding.ts", "buildSubjectMotionBindings"],
  ["subject motion route", "src/app/api/admingeneration/editor/projects/[id]/subject-motion-bindings/route.ts", "buildSubjectMotionBindings"],
  ["object mask data", "src/lib/admingeneration/editor/object-mask-data.ts", "buildObjectMaskData"],
  ["object mask route", "src/app/api/admingeneration/editor/projects/[id]/object-mask-data/route.ts", "buildObjectMaskData"],
  ["seam repair plan", "src/lib/admingeneration/editor/seam-repair-plan.ts", "buildSeamRepairPlan"],
  ["seam repair route", "src/app/api/admingeneration/editor/projects/[id]/seam-repair-plan/route.ts", "buildSeamRepairPlan"],
  ["professional readiness", "src/lib/admingeneration/editor/professional-readiness.ts", "buildProfessionalReadiness"],
  ["professional readiness route", "src/app/api/admingeneration/editor/projects/[id]/professional-readiness/route.ts", "buildProfessionalReadiness"],
];

let failed = false;

console.log("=================================================");
console.log("MICRO EDIT PRODUCTION LAYERS AUDIT");
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
