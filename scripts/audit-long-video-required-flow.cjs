const fs = require("fs");

const checks = [
  ["production planner", "src/lib/admingeneration/long-video/minimal-long-video-production.ts", "buildMinimalLongVideoProductionPlan"],
  ["dispatch builder", "src/lib/admingeneration/long-video/long-video-dispatch.ts", "buildLongVideoDispatchPlan"],
  ["dispatch route", "src/app/api/admingeneration/long-video/dispatch/route.ts", "/api/streams/video/generate"],
  ["status builder", "src/lib/admingeneration/long-video/long-video-status.ts", "buildLongVideoStatus"],
  ["status route", "src/app/api/admingeneration/long-video/status/route.ts", "buildLongVideoStatus"],
  ["continuity QA builder", "src/lib/admingeneration/long-video/long-video-continuity-qa.ts", "evaluateLongVideoContinuityQa"],
  ["continuity QA route", "src/app/api/admingeneration/long-video/continuity-qa/route.ts", "evaluateLongVideoContinuityQa"],
  ["stitch payload builder", "src/lib/admingeneration/long-video/long-video-stitch-submit.ts", "buildLongVideoStitchSubmitPayload"],
  ["stitch submit route", "src/app/api/admingeneration/long-video/stitch-submit/route.ts", "/api/streams/stitch"],
  ["run route", "src/app/api/admingeneration/long-video/run/route.ts", "ready_to_dispatch"],
];

let failed = false;

console.log("=================================================");
console.log("LONG VIDEO REQUIRED FLOW AUDIT");
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
