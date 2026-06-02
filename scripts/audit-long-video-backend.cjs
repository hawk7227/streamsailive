const fs = require("fs");

const checks = [
  ["long video contract", "src/lib/admingeneration/long-video/long-video-contract.ts", "buildLongVideoPlan"],
  ["long video plan route", "src/app/api/admingeneration/editor/projects/[id]/long-video/plan/route.ts", "buildLongVideoPlan"],
  ["stitch plan model", "src/lib/admingeneration/long-video/long-video-stitch-plan.ts", "buildLongVideoStitchPlan"],
  ["stitch plan route", "src/app/api/admingeneration/editor/projects/[id]/long-video/stitch-plan/route.ts", "buildLongVideoStitchPlan"],
  ["readiness model", "src/lib/admingeneration/long-video/long-video-readiness.ts", "evaluateLongVideoReadiness"],
  ["readiness route", "src/app/api/admingeneration/editor/projects/[id]/long-video/readiness/route.ts", "evaluateLongVideoReadiness"],
];

let failed = false;

console.log("=================================================");
console.log("LONG VIDEO BACKEND AUDIT");
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
