#!/usr/bin/env node
const fs = require('fs');

function countSections(content) {
  return content.split(/\r?\n/).filter((l) => l.startsWith('## ')).length;
}

function collectRuleIds(content, type) {
  const ids = new Set();
  let regex;
  if (type === 'assistant') regex = /Rule AC\.\d+\.\d+/g;
  else regex = /Rule (?:\d+\.\d+|[A-Z]+(?:\.[A-Z]+)?\.\d+)/g;
  for (const m of content.matchAll(regex)) ids.add(m[0]);
  return ids;
}

function collectProjectPromptIds(content) {
  const ids = new Set(['GO', 'CONTINUE', 'RESUME', 'REPORT']);
  for (const m of content.matchAll(/(GO|CONTINUE|RESUME|REPORT)\s+(?:step|item)\s+(\d+)/g)) {
    ids.add(`${m[1]} ${m[2]}`);
    ids.add(`${m[1]} step ${m[2]}`);
    ids.add(`${m[1]} item ${m[2]}`);
  }
  return ids;
}

function extractLine(body, filename) {
  return body.split(/\r?\n/).find((l) => l.includes(filename));
}

function extractSectionCount(line) {
  if (!line) return null;
  const m = line.match(/sections?\s*[:= -]?\s*(\d+)|(\d+)\s*sections?/i);
  if (!m) return null;
  return Number(m[1] || m[2]);
}

function parseIdsFromLine(line, type) {
  if (!line) return [];
  if (type === 'project') {
    const out = [];
    for (const m of line.matchAll(/\b(GO|CONTINUE|RESUME|REPORT)\b(?:\s+(?:step|item)\s+\d+)?/g)) out.push(m[0]);
    return [...new Set(out)];
  }
  const re = type === 'assistant'
    ? /Rule AC\.\d+\.\d+/g
    : /Rule (?:\d+\.\d+|[A-Z]+(?:\.[A-Z]+)?\.\d+)/g;
  return [...new Set([...line.matchAll(re)].map((m) => m[0]))];
}

function expectedExample(filename, sections, type, sampleIds) {
  if (type === 'project') {
    return `${filename}: sections=${sections}; identifiers: GO, CONTINUE, REPORT`;
  }
  return `${filename}: sections=${sections}; rules: ${sampleIds.slice(0,3).join(', ')}`;
}

function validate(body) {
  const specs = [
    ['BUILD_RULES.md', 'build'],
    ['FRONTEND_BUILD_RULES.md', 'frontend'],
    ['ASSISTANT_CONDUCT_RULES.md', 'assistant'],
    ['PROJECT_PROMPTS.md', 'project'],
  ];
  const failures = [];

  for (const [file, type] of specs) {
    const content = fs.readFileSync(file, 'utf8');
    const sections = countSections(content);
    const line = extractLine(body, file);
    const idsInFile = type === 'project' ? collectProjectPromptIds(content) : collectRuleIds(content, type);
    const sampleIds = [...idsInFile].slice(0, 3);

    if (!line) {
      failures.push(`${file}: missing line. Expected format example: "${expectedExample(file, sections, type, sampleIds)}"`);
      continue;
    }

    const declaredSections = extractSectionCount(line);
    if (declaredSections === null) {
      failures.push(`${file}: section count missing/invalid in line: "${line}". Expected section count: ${sections}.`);
    } else if (declaredSections !== sections) {
      failures.push(`${file}: wrong section count ${declaredSections}; expected ${sections}.`);
    }

    const ids = parseIdsFromLine(line, type);
    if (ids.length < 3) {
      failures.push(`${file}: fewer than 3 identifiers/rule IDs found in line: "${line}".`);
    } else {
      const missing = ids.filter((id) => !idsInFile.has(id));
      if (missing.length) {
        failures.push(`${file}: identifiers not found in file: ${missing.join(', ')}.`);
      }
    }
  }
  return failures;
}

if (require.main === module) {
  const body = process.argv[2] ?? fs.readFileSync(0, 'utf8');
  const failures = validate(body);
  if (failures.length) {
    console.log('INVALID');
    failures.forEach((f) => console.log(`- ${f}`));
    process.exit(1);
  }
  console.log('VALID');
}

module.exports = { validate };
