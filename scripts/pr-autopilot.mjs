#!/usr/bin/env node
import { execSync } from 'node:child_process';
const push=process.argv.includes('--push');
const branch=execSync('git branch --show-current',{encoding:'utf8'}).trim();
if(branch==='main') {console.error('Refusing on main'); process.exit(1);} 
try{ execSync('git fetch origin main',{stdio:'inherit'});}catch{}
try{ execSync('git merge --no-edit origin/main',{stdio:'inherit'});}catch{ console.error('Merge conflicts detected. Resolve manually; inspect markers with: git diff --name-only --diff-filter=U'); process.exit(1);} 
try{ execSync('git restore public/build-report.json',{stdio:'ignore'});}catch{}
execSync('node scripts/check-pr-ready.mjs',{stdio:'inherit'});
if(push){ execSync('git push origin HEAD',{stdio:'inherit'});} else { console.log('Checks passed. Next: git push origin HEAD'); }
