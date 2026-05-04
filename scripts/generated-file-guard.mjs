#!/usr/bin/env node
import { execSync } from 'node:child_process';
const selfTest = process.argv.includes('--self-test');
const useWorkingTree = process.argv.includes('--working-tree');
const forbidden = ['public/build-report.json','audit-report.txt','.next/','node_modules/','coverage/'];
const isForbidden = (f)=>forbidden.some(p=>p.endsWith('/')?f.startsWith(p):f===p)||f.endsWith('.log');
function check(files){ const bad=files.filter(isForbidden); return {ok:bad.length===0,bad}; }
if (selfTest){
  const t1=check(['public/build-report.json']); if(t1.ok){console.error('self-test fail block');process.exit(1);} 
  const t2=check(['scripts/scope-guard.mjs']); if(!t2.ok){console.error('self-test fail pass');process.exit(1);} 
  console.log('generated-file-guard self-test: PASS'); process.exit(0);
}
let files=[];
if (useWorkingTree){ files=execSync('git diff --name-only',{encoding:'utf8'}).trim().split('\n').filter(Boolean); }
else try{ const base=process.env.GITHUB_BASE_REF?`origin/${process.env.GITHUB_BASE_REF}`:'origin/main'; execSync(`git rev-parse --verify ${base}`,{stdio:'pipe'}); files=execSync(`git diff --name-only ${base}...HEAD`,{encoding:'utf8'}).trim().split('\n').filter(Boolean);}catch{files=execSync('git diff --name-only HEAD^...HEAD',{encoding:'utf8'}).trim().split('\n').filter(Boolean);console.log('WARNING: using HEAD^...HEAD fallback');}
const r=check(files); if(!r.ok){console.error('generated-file-guard FAIL:',r.bad);console.error('Fix with: git restore public/build-report.json');process.exit(1);} 
console.log('generated-file-guard PASS');
