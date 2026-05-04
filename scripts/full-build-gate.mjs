#!/usr/bin/env node
import { runBuildQualityGate } from '../src/lib/streams/build-runtime/build-quality-gate.ts';
import { decidePreCall } from '../src/lib/streams/ai-prevention/pre-call-decision.ts';
import { decideBatchRouting } from '../src/lib/streams/ai-prevention/batch-routing-policy.ts';

if (process.argv.includes('--self-test')) {
  const tests = [
    ['tool skip', decidePreCall('tool_action','show status').shouldCallModel===false],
    ['build no skip', decidePreCall('build','build feature').shouldCallModel===true],
    ['unknown no skip', decidePreCall('unknown','???').shouldCallModel===true],
    ['file analysis not cache', decidePreCall('file_analysis','analyze private upload').responseCacheEligible===false],
    ['chat cache eligible', decidePreCall('normal_chat','what is markdown').responseCacheEligible===true],
    ['batch reject live chat', decideBatchRouting('normal_chat','repo_summaries').batchEligible===false],
    ['gate pass narrow', runBuildQualityGate({userRequest:'Only make the layout',assistantOutput:'layout-only runtime not built classification Implemented but unproven',checksRun:['tsc'],classification:'Implemented but unproven'}).passed===true],
    ['gate fail build layout', runBuildQualityGate({userRequest:'build editor',assistantOutput:'layout-only',checksRun:['tsc'],classification:'Implemented but unproven'}).passed===false],
    ['gate fail consolelog', runBuildQualityGate({userRequest:'build editor',assistantOutput:'console.log("x")',checksRun:['tsc'],classification:'Implemented but unproven'}).passed===false],
  ];
  const bad = tests.filter(([,ok])=>!ok);
  if (bad.length) { console.error('SELF-TEST FAIL', bad.map(([n])=>n)); process.exit(1); }
  console.log('SELF-TEST PASS', tests.length); process.exit(0);
}
const sample = process.argv.slice(2).join(' ') || 'layout-only';
const bad = /(layout-only|shell-only|inventory-only|scaffold-only|console\.log\()/i.test(sample);
if (bad) { console.error('Full Build Gate fail:', sample); process.exit(1); }
console.log('Full Build Gate pass');
