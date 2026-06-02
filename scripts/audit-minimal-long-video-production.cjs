const fs = require("fs");

const checks = [
  ["minimal long video planner", "src/lib/admingeneration/long-video/minimal-long-video-production.ts", "buildMinimalLongVideoProductionPlan"],
  ["long video generation route", "src/app/api/admingeneration/long-video/route.ts", "generationMode"],
  ["identity lock", "src/lib/admingeneration/long-video/minimal-long-video-production.ts", "identityLock"],
  ["stitch required", "src/lib/admingeneration/long-video/minimal-long-video-production.ts", "stitchRequired"],
  ["continuity QA", "src/lib/admingeneration/long-video/minimal-long-video-production.ts", "continuityQa"],
];

let failed = false;

console.log("=================================================");
console.log("MINIMAL LONG VIDEO PRODUCTION AUDIT");
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
