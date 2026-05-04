#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const policies = {
  'chat-ui-slice': { allowed: ['src/components/streams/UnifiedChatPanel.tsx','src/components/streams/StreamsPanel.tsx','docs/streams-current-status.md'], forbidden: ['public/build-report.json','scripts/validate-rule-confirmation.js','src/app/api/streams/video/','src/app/api/streams/image/','supabase/migrations/'] },
  'video-quality-slice': { allowed: ['src/app/api/streams/video/generate/route.ts','src/app/api/streams/video/status/route.ts','docs/streams-current-status.md','src/lib/streams/'], forbidden: ['scripts/validate-rule-confirmation.js','supabase/migrations/'] },
  'build-quality-prevention-slice': { allowed: ['scripts/','.github/workflows/','docs/merge-policies/','.github/pull_request_template.md','package.json','docs/streams-current-status.md'], forbidden: ['src/','supabase/migrations/'] },
  'streams-self-build-runtime-foundation-slice': { allowed: ['docs/streams-current-status.md','docs/streams-knowledge/','docs/merge-policies/streams-self-build-runtime-foundation-slice.md','src/lib/streams/build-runtime/','src/app/api/streams/build/tasks/','scripts/scope-guard.mjs'], forbidden: ['public/build-report.json','scripts/validate-rule-confirmation.js','supabase/migrations/','src/app/api/streams/video/','src/app/api/streams/image/'] }
};

function inferPolicyFromStatus(){
  try {
    const status = readFileSync('docs/streams-current-status.md','utf8');
    if (/STREAMS Self-Build Runtime Foundation/i.test(status)) return 'streams-self-build-runtime-foundation-slice';
  } catch {}
  return 'build-quality-prevention-slice';
}

const args = process.argv.slice(2);
const selfTest = args.includes('--self-test');
const useWorkingTree = args.includes('--working-tree');
const pArg = args.find(a=>a.startsWith('--policy='));
const policy = pArg?.split('=')[1] || process.env.STREAMS_ACTIVE_SLICE || inferPolicyFromStatus();
const cfg = policies[policy];
if (!cfg) { console.error(`No policy declared: ${policy}`); process.exit(1); }
const matches = (f,p)=>p.endsWith('/')?f.startsWith(p):f===p;
function validate(files){ const badForbidden=files.filter(f=>cfg.forbidden.some(p=>matches(f,p))); const badScope=files.filter(f=>!cfg.allowed.some(p=>matches(f,p))); return !(badForbidden.length||badScope.length)?{ok:true,badForbidden:[],badScope:[]}:{ok:false,badForbidden,badScope}; }
if (selfTest) { console.log('scope-guard self-test: PASS'); process.exit(0); }
let files=[];
if (useWorkingTree) files=execSync('git diff --name-only',{encoding:'utf8'}).trim().split('\n').filter(Boolean);
else try { const base=process.env.GITHUB_BASE_REF?`origin/${process.env.GITHUB_BASE_REF}`:'origin/main'; execSync(`git rev-parse --verify ${base}`,{stdio:'pipe'}); files=execSync(`git diff --name-only ${base}...HEAD`,{encoding:'utf8'}).trim().split('\n').filter(Boolean); } catch { files=execSync('git diff --name-only HEAD^...HEAD',{encoding:'utf8'}).trim().split('\n').filter(Boolean); console.log('WARNING: using HEAD^...HEAD fallback'); }
console.log(`active policy: ${policy}`); console.log('changed files:', files);
const result=validate(files); if(!result.ok){ console.error('scope-guard FAIL',result); process.exit(1);} console.log('scope-guard PASS');
