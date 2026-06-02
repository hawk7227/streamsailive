const fs = require("fs");

const checks = [
  ["story bible", "src/lib/admingeneration/long-video/long-video-story-bible.ts", "buildLongVideoStoryBible"],
  ["shot planner", "src/lib/admingeneration/long-video/long-video-shot-planner.ts", "buildProfessionalShotPlan"],
  ["continuity plan", "src/lib/admingeneration/long-video/long-video-continuity.ts", "buildLongVideoContinuityPlan"],
  ["production plan route", "src/app/api/admingeneration/long-video/production-plan/route.ts", "productionPlan"],
];

let failed = false;

console.log("=================================================");
console.log("LONG VIDEO PRODUCTION SYSTEM AUDIT");
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
