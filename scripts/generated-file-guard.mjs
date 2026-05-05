#!/usr/bin/env node
import { execSync } from 'node:child_process';

const blocked = new Set([
  'public/build-report.json',
  '.next',
  'dist',
  'coverage',
]);

const changed = execSync('git status --short', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .map((line) => line.slice(3).trim());

const offenders = changed.filter((file) => {
  if (blocked.has(file)) return true;
  return [...blocked].some((prefix) => file === prefix || file.startsWith(`${prefix}/`));
});

if (offenders.length) {
  console.error('Generated file guard failed. Blocked files present:');
  offenders.forEach((f) => console.error(` - ${f}`));
  process.exit(1);
}

console.log('generated-file-guard: pass');
