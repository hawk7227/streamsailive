const alwaysForbidden = ["public/build-report.json", "scripts/validate-rule-confirmation.js"];
export function validatePatchTargets(targets: string[], allowedFiles: string[], forbiddenFiles: string[]) {
  for (const target of targets) {
    if (alwaysForbidden.includes(target) || forbiddenFiles.includes(target)) return { ok: false, reason: `Blocked target: ${target}` };
    if (allowedFiles.length > 0 && !allowedFiles.some((prefix) => target.startsWith(prefix.replace("/**", "")))) return { ok: false, reason: `Required file is outside active slice policy: ${target}` };
  }
  return { ok: true };
}
