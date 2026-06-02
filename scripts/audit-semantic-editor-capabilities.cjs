const fs = require("fs");

const requiredFiles = [
  "src/app/admingeneration/editor/page.jsx",
  "src/components/admingeneration/FullOutputEditorClient.jsx",
  "src/components/admingeneration/FullOutputEditorClient.module.css",
  "src/lib/admingeneration/editor/semantic-editor-capabilities.ts",
  "src/app/api/admingeneration/reference/analyze/[id]/intelligence/route.ts",
  "src/app/api/admingeneration/reference/analyze/[id]/enrich/route.ts",
  "src/app/api/admingeneration/reference/upload-and-analyze/route.ts",
  "src/app/api/admingeneration/editor/from-analysis/route.ts",
  "src/app/api/admingeneration/editor/projects/[id]/timeline/route.ts",
  "src/app/api/admingeneration/editor/projects/[id]/versions/route.ts",
  "src/app/api/admingeneration/editor/projects/[id]/version-actions/route.ts",
  "src/app/api/admingeneration/editor/projects/[id]/execute-edit/route.ts",
  "src/app/api/admingeneration/editor/projects/[id]/transcript-edits/route.ts",
  "src/app/api/admingeneration/editor/projects/[id]/qc/route.ts",
  "src/app/api/admingeneration/editor/projects/[id]/export-final/route.ts",
  "src/app/api/admingeneration/editor/projects/[id]/provider-runs/route.ts",
  "src/app/api/admingeneration/editor/projects/[id]/stitch-jobs/route.ts",
  "src/app/api/pipeline-test/audio/extract/route.ts",
  "src/app/api/pipeline-test/audio/separate/route.ts",
  "src/app/api/pipeline-test/transcript/transcribe/route.ts",
  "src/app/api/streams/video/edit-voice/route.ts",
  "src/app/api/streams/video/edit-motion/route.ts",
  "src/app/api/streams/video/edit-body/route.ts",
  "src/app/api/streams/video/edit-emotion/route.ts",
  "src/app/api/streams/video/dub/route.ts",
  "src/app/api/streams/voice/generate/route.ts",
  "src/app/api/streams/stitch/route.ts",
];

const frontendChecks = [
  ["Selected-target action bar", "selectedActionBar"],
  ["Inline timeline editing", "saveInlineEdit"],
  ["Transcript edits route", "transcript-edits"],
  ["Execute-edit route", "execute-edit"],
  ["Export-final route", "export-final"],
  ["QA checklist", "qaChecklist"],
  ["First-time guide", "guideOverlay"],
  ["Full video regeneration separation", "regenerateEntireVideo"],
  ["Preserve original flag", "preserveOriginal"],
  ["Full video regeneration flag", "fullVideoRegeneration"],
  ["Separate full video CTA", "Regenerate Entire Video"],
  ["Targeted segment CTA", "Regenerate Selected Segment"],
];

let failed = false;

console.log("=================================================");
console.log("SEMANTIC VIDEO EDITOR CAPABILITY AUDIT");
console.log("=================================================");

for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file}`);
    failed = true;
  }
}

const frontendPath = "src/components/admingeneration/FullOutputEditorClient.jsx";
const frontend = fs.existsSync(frontendPath) ? fs.readFileSync(frontendPath, "utf8") : "";

console.log("");
console.log("Frontend feature checks:");
for (const [label, needle] of frontendChecks) {
  if (frontend.includes(needle)) {
    console.log(`✅ ${label}`);
  } else {
    console.log(`❌ ${label}`);
    failed = true;
  }
}

const forbidden = ["fake success", "simulated success", "placeholder output", "fake output"];
console.log("");
console.log("No-fake wording check:");
for (const needle of forbidden) {
  if (frontend.toLowerCase().includes(needle)) {
    console.log(`❌ Forbidden wording found: ${needle}`);
    failed = true;
  } else {
    console.log(`✅ no '${needle}'`);
  }
}

console.log("=================================================");
if (failed) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS");
