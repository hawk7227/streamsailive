#!/usr/bin/env node
import { execSync } from 'node:child_process';

function run(cmd, allowFail = false) {
  try {
    execSync(cmd, { stdio: 'inherit', shell: '/bin/bash' });
    return true;
  } catch {
    if (!allowFail) process.exit(1);
    return false;
  }
}

run('git diff --check');
run('npx tsc --noEmit');
run('pnpm build');
run('git restore public/build-report.json 2>/dev/null || true', true);
run('if [ -f scripts/scope-guard.mjs ]; then node scripts/scope-guard.mjs; fi');
run('node scripts/generated-file-guard.mjs');
run('PYTHONIOENCODING=utf-8 python scripts/audit.py || py scripts/audit.py || python3 scripts/audit.py');

console.log('check-pr-ready: pass');
