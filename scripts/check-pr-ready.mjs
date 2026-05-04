#!/usr/bin/env node
import { execSync } from 'node:child_process';
function run(cmd,allow=false){ try{ console.log(`$ ${cmd}`); console.log(execSync(cmd,{encoding:'utf8',stdio:'pipe'})); return true;}catch(e){ console.error(e.stdout?.toString()||''); console.error(e.stderr?.toString()||''); if(!allow) process.exit(1); return false; } }
run('git status --short');
run('node scripts/scope-guard.mjs --self-test');
run('node scripts/generated-file-guard.mjs --self-test');
run('node scripts/scope-guard.mjs --working-tree');
run('node scripts/generated-file-guard.mjs --working-tree');
run('git diff --check');
run('npx tsc --noEmit');
run('pnpm build');
run('git restore public/build-report.json',true);
if(!run('python scripts/audit.py',true)){ if(!run('py scripts/audit.py',true)){ run('python3 scripts/audit.py'); }}
const status=execSync('git status --short',{encoding:'utf8'}).trim();
if(status){ console.error(status); console.error('PR-ready checks: FAIL (working tree not clean)'); process.exit(1);} 
console.log('PR-ready checks: PASS');
