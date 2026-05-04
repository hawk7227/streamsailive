#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const policies = {
  'chat-ui-slice': {
    allowed: ['src/components/streams/UnifiedChatPanel.tsx','src/components/streams/StreamsPanel.tsx','docs/streams-current-status.md'],
    forbidden: ['public/build-report.json','scripts/validate-rule-confirmation.js','src/app/api/streams/video/','src/app/api/streams/image/','supabase/migrations/']
  },
  'video-quality-slice': {
    allowed: ['src/app/api/streams/video/generate/route.ts','src/app/api/streams/video/status/route.ts','docs/streams-current-status.md','src/lib/streams/'],
    forbidden: ['scripts/validate-rule-confirmation.js','supabase/migrations/']
  },
  'build-quality-prevention-slice': {
    allowed: ['scripts/','.github/workflows/','docs/merge-policies/','.github/pull_request_template.md','package.json','docs/streams-current-status.md'],
    forbidden: ['src/','supabase/migrations/']
  },
  'streams-live-preview-artifact-workspace-runtime': {
    allowed: [
      'docs/streams-current-status.md',
      'src/components/streams/UnifiedChatPanel.tsx',
      'src/app/api/streams/chat/route.ts',
      'src/components/streams/preview/',
      'src/lib/streams/preview/',
      'docs/merge-policies/',
      'scripts/scope-guard.mjs'
    ],
    forbidden: [
      'public/build-report.json',
      'scripts/validate-rule-confirmation.js',
      'src/app/api/streams/video/',
      'src/app/api/streams/image/',
      'src/lib/streams/video/',
      'supabase/migrations/',
      'src/components/editor/video-timeline/',
      'src/app/api/files/upload/',
      'src/app/api/settings/providers/'
    ]
  }
};
const args = process.argv.slice(2);
const selfTest = args.includes('--self-test');
const useWorkingTree = args.includes('--working-tree');
const pArg = args.find(a=>a.startsWith('--policy='));
function inferPolicyFromStatusFile() {
  try {
    const status = fs.readFileSync('docs/streams-current-status.md', 'utf8');
    if (/STREAMS Live Preview \/ Artifact Workspace Runtime/i.test(status)) return 'streams-live-preview-artifact-workspace-runtime';
  } catch {}
  return null;
}
const policy = pArg?.split('=')[1] || process.env.STREAMS_ACTIVE_SLICE || inferPolicyFromStatusFile() || 'build-quality-prevention-slice';
const cfg = policies[policy];
if (!cfg) { console.error(`No policy declared: ${policy}`); process.exit(1); }
const matches = (f,p)=>p.endsWith('/')?f.startsWith(p):f===p;
function validate(files){
  const badForbidden = files.filter(f=>cfg.forbidden.some(p=>matches(f,p)));
  const badScope = files.filter(f=>!cfg.allowed.some(p=>matches(f,p)));
  if (badForbidden.length||badScope.length) return {ok:false,badForbidden,badScope};
  return {ok:true,badForbidden:[],badScope:[]};
}
if (selfTest) {
  const tests = [
    {name:'chat allowed',policy:'chat-ui-slice',files:['src/components/streams/UnifiedChatPanel.tsx','src/components/streams/StreamsPanel.tsx'],ok:true},
    {name:'chat forbidden generated',policy:'chat-ui-slice',files:['public/build-report.json'],ok:false},
    {name:'build quality allowed',policy:'build-quality-prevention-slice',files:['scripts/a.mjs','.github/workflows/a.yml','docs/merge-policies/README.md','package.json'],ok:true},
    {name:'build quality runtime forbidden',policy:'build-quality-prevention-slice',files:['src/components/streams/UnifiedChatPanel.tsx'],ok:false},
    {name:'preview slice allows panel',policy:'streams-live-preview-artifact-workspace-runtime',files:['src/components/streams/UnifiedChatPanel.tsx','docs/streams-current-status.md'],ok:true},
    {name:'preview slice forbids provider routes',policy:'streams-live-preview-artifact-workspace-runtime',files:['src/app/api/streams/video/generate/route.ts'],ok:false}
  ];
  for (const t of tests){const c=policies[t.policy]; const r={ok:!(t.files.filter(f=>c.forbidden.some(p=>matches(f,p))).length||t.files.filter(f=>!c.allowed.some(p=>matches(f,p))).length)}; if(r.ok!==t.ok){console.error(`SELF-TEST FAIL: ${t.name}`);process.exit(1);} }
  console.log('scope-guard self-test: PASS'); process.exit(0);
}
let files=[];
if (useWorkingTree) {
  files = execSync('git diff --name-only',{encoding:'utf8'}).trim().split('\n').filter(Boolean);
} else try {
  const base = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main';
  execSync(`git rev-parse --verify ${base}`,{stdio:'pipe'});
  files = execSync(`git diff --name-only ${base}...HEAD`,{encoding:'utf8'}).trim().split('\n').filter(Boolean);
} catch {
  files = execSync('git diff --name-only HEAD^...HEAD',{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  console.log('WARNING: using HEAD^...HEAD fallback');
}
console.log(`active policy: ${policy}`);
console.log('changed files:', files);
const result=validate(files);
if(!result.ok){ console.error('scope-guard FAIL',result); process.exit(1);}
console.log('scope-guard PASS');
