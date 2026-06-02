const fs = require("fs");

const checks = [
  ["migration", "supabase/migrations/20260602000100_admingeneration_editor_core.sql", "admingeneration_editor_projects"],
  ["supabase service client", "src/lib/supabase/service.ts", "getSupabaseServiceClient"],
  ["editor repository", "src/lib/admingeneration/db/editor-repository.ts", "seedEditorProofProject"],
  ["db proof route", "src/app/api/admingeneration/db-proof/route.ts", "db_write_read_proven"],
];

let failed = false;

console.log("=================================================");
console.log("ADMINGENERATION DB PERSISTENCE AUDIT");
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

if (failed) {
  console.log("RESULT: FAIL");
  process.exit(1);
}

console.log("RESULT: PASS");
